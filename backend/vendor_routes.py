"""Vendor platform routes: wallet, payouts, referrals, notifications, pricing admin."""
from __future__ import annotations

from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from pricing_engine import (
    get_platform_settings,
    get_active_pricing_rules,
    default_platform_settings,
    product_to_vendor_out,
    enrich_product_for_customer,
)
from platform_services import (
    iso_now,
    generate_referral_code,
    log_audit,
    create_notification,
    get_wallet_summary,
    release_pending_earnings,
    process_referral_on_approval,
    credit_vendor_order_earning,
    payout_to_out,
    wallet_tx_to_out,
)


class BankDetailsIn(BaseModel):
    account_holder_name: str = Field(min_length=2)
    bank_name: str = Field(min_length=2)
    account_number: str = Field(min_length=5)
    ifsc_code: str = Field(min_length=5)


class PayoutRequestIn(BaseModel):
    amount: float = Field(gt=0)


class PricingRuleIn(BaseModel):
    rule_type: str  # global | category | subcategory | vendor | product
    target_id: Optional[str] = ""
    markup_pct: float = Field(ge=0, le=500)
    active: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    priority: Optional[int] = None


class PlatformSettingsIn(BaseModel):
    global_markup_pct: Optional[float] = None
    gst_rate: Optional[float] = None
    cgst_rate: Optional[float] = None
    sgst_rate: Optional[float] = None
    tax_inclusive: Optional[bool] = None
    platform_fee: Optional[float] = None
    free_delivery_threshold: Optional[float] = None
    delivery_near_km: Optional[float] = None
    delivery_near_fee: Optional[float] = None
    delivery_per_km: Optional[float] = None
    min_payout_amount: Optional[float] = None
    settlement_days: Optional[int] = None
    referral_reward_amount: Optional[float] = None
    product_approval_required: Optional[bool] = None


class VendorBankUpdate(BaseModel):
    bank_details: BankDetailsIn


class ReferralRegisterIn(BaseModel):
    referral_code: Optional[str] = None


def register_platform_routes(api, db, deps):
    get_current_user = deps["get_current_user"]
    require_admin = deps["require_admin"]
    get_vendor_for_user = deps["get_vendor_for_user"]
    get_vendor_profile = deps["get_vendor_profile"]
    vendor_to_out = deps["vendor_to_out"]
    safe_object_id = deps["safe_object_id"]
    VENDOR_STATUSES = deps["VENDOR_STATUSES"]

    # ------------------------------------------------------------------
    # Vendor: pending status screen (can login but limited)
    # ------------------------------------------------------------------
    @api.get("/vendor/verification-status")
    async def vendor_verification_status(user: dict = Depends(get_current_user)):
        if user.get("role") != "vendor":
            raise HTTPException(status_code=403, detail="Vendor access required")
        vendor = await get_vendor_profile(user)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor profile not found")
        return {
            "status": vendor.get("status", "Pending"),
            "rejection_reason": vendor.get("rejection_reason", ""),
            "can_access_dashboard": vendor.get("status") == "Approved",
            "vendor": vendor_to_out(vendor),
        }

    # ------------------------------------------------------------------
    # Vendor wallet & payouts
    # ------------------------------------------------------------------
    @api.get("/vendor/wallet")
    async def vendor_wallet(user: dict = Depends(get_current_user)):
        vendor = await get_vendor_for_user(user)
        vid = str(vendor["_id"])
        await release_pending_earnings(db, vid)
        summary = await get_wallet_summary(db, vid)
        return {"vendor_id": vid, **summary}

    @api.get("/vendor/wallet/transactions")
    async def vendor_wallet_transactions(user: dict = Depends(get_current_user), limit: int = 100):
        vendor = await get_vendor_for_user(user)
        vid = str(vendor["_id"])
        docs = await db.wallet_transactions.find({
            "vendor_id": vid,
            "transaction_type": {"$ne": "platform_deduction"},
        }).sort("created_at", -1).limit(limit).to_list(limit)
        return [wallet_tx_to_out(t, vendor_view=True) for t in docs]

    @api.get("/vendor/payouts")
    async def vendor_payouts(user: dict = Depends(get_current_user)):
        vendor = await get_vendor_for_user(user)
        vid = str(vendor["_id"])
        docs = await db.payouts.find({"vendor_id": vid}).sort("created_at", -1).to_list(200)
        return [payout_to_out(p) for p in docs]

    @api.post("/vendor/payouts/request")
    async def vendor_request_payout(payload: PayoutRequestIn, user: dict = Depends(get_current_user)):
        vendor = await get_vendor_for_user(user)
        vid = str(vendor["_id"])
        settings = await get_platform_settings(db)
        min_amt = float(settings.get("min_payout_amount", 500))

        if not vendor.get("bank_details", {}).get("account_number"):
            raise HTTPException(status_code=400, detail="Add bank details before requesting a payout")

        await release_pending_earnings(db, vid)
        summary = await get_wallet_summary(db, vid)
        available = summary["available_balance"]

        if payload.amount < min_amt:
            raise HTTPException(status_code=400, detail=f"Minimum payout amount is ₹{min_amt:.0f}")
        if payload.amount > available:
            raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ₹{available:.2f}")

        doc = {
            "vendor_id": vid,
            "vendor_name": vendor.get("business_name", ""),
            "amount": round(payload.amount, 2),
            "status": "Pending",
            "payment_method": "bank_transfer",
            "bank_account": vendor.get("bank_details", {}),
            "created_at": iso_now(),
        }
        res = await db.payouts.insert_one(doc)
        doc["_id"] = res.inserted_id

        await create_notification(
            db,
            user_id=user["id"],
            role="vendor",
            title="Payout requested",
            body=f"Your payout request of ₹{payload.amount:.2f} is pending admin approval.",
            ntype="payout",
            link="/vendor/payouts",
        )
        return payout_to_out(doc)

    @api.patch("/vendor/bank-details")
    async def vendor_update_bank(payload: VendorBankUpdate, user: dict = Depends(get_current_user)):
        vendor = await get_vendor_for_user(user)
        bank = payload.bank_details.model_dump()
        await db.vendors.update_one({"_id": vendor["_id"]}, {"$set": {"bank_details": bank}})
        updated = await db.vendors.find_one({"_id": vendor["_id"]})
        return vendor_to_out(updated)

    # ------------------------------------------------------------------
    # Vendor referrals
    # ------------------------------------------------------------------
    @api.get("/vendor/referrals")
    async def vendor_referrals(user: dict = Depends(get_current_user)):
        vendor = await get_vendor_for_user(user)
        vid = str(vendor["_id"])
        code = vendor.get("referral_code") or generate_referral_code()
        if not vendor.get("referral_code"):
            await db.vendors.update_one({"_id": vendor["_id"]}, {"$set": {"referral_code": code}})

        refs = await db.referrals.find({"referrer_vendor_id": vid}).sort("created_at", -1).to_list(200)
        total = len(refs)
        pending = sum(1 for r in refs if r.get("status") in ("pending", "registered"))
        approved = sum(1 for r in refs if r.get("status") in ("approved", "paid"))
        paid_earnings = sum(float(r.get("reward_amount") or 0) for r in refs if r.get("status") == "paid")

        return {
            "referral_code": code,
            "referral_link": f"/become-vendor?ref={code}",
            "total_referrals": total,
            "pending_referrals": pending,
            "approved_referrals": approved,
            "referral_earnings": round(paid_earnings, 2),
            "referrals": [{
                "id": str(r["_id"]),
                "referred_vendor_id": r.get("referred_vendor_id"),
                "status": r.get("status"),
                "reward_amount": r.get("reward_amount"),
                "created_at": r.get("created_at"),
            } for r in refs],
        }

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------
    @api.get("/notifications")
    async def list_notifications(user: dict = Depends(get_current_user), unread_only: bool = False):
        q = {"user_id": user["id"]}
        if unread_only:
            q["read"] = False
        docs = await db.notifications.find(q).sort("created_at", -1).limit(100).to_list(100)
        return [{
            "id": str(n["_id"]),
            "title": n.get("title"),
            "body": n.get("body"),
            "type": n.get("type"),
            "link": n.get("link"),
            "read": n.get("read", False),
            "created_at": n.get("created_at"),
        } for n in docs]

    @api.patch("/notifications/{notif_id}/read")
    async def mark_notification_read(notif_id: str, user: dict = Depends(get_current_user)):
        oid = safe_object_id(notif_id)
        await db.notifications.update_one(
            {"_id": oid, "user_id": user["id"]},
            {"$set": {"read": True}},
        )
        return {"success": True}

    @api.post("/notifications/read-all")
    async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
        await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
        return {"success": True}

    # ------------------------------------------------------------------
    # Admin: pricing & platform settings
    # ------------------------------------------------------------------
    @api.get("/admin/platform-settings")
    async def admin_get_platform_settings(_: dict = Depends(require_admin)):
        return await get_platform_settings(db)

    @api.patch("/admin/platform-settings")
    async def admin_update_platform_settings(payload: PlatformSettingsIn, admin: dict = Depends(require_admin)):
        old = await get_platform_settings(db)
        update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
        if not update:
            return old
        await db.platform_settings.update_one({"_id": "default"}, {"$set": update}, upsert=True)
        new = await get_platform_settings(db)
        await log_audit(
            db,
            actor_id=admin["id"],
            actor_role="admin",
            action="update_platform_settings",
            entity_type="platform_settings",
            previous_value=old,
            new_value=new,
        )
        return new

    @api.get("/admin/pricing-rules")
    async def admin_list_pricing_rules(_: dict = Depends(require_admin)):
        docs = await db.pricing_rules.find({}).sort("rule_type", 1).to_list(500)
        return [{
            "id": str(r["_id"]),
            "rule_type": r.get("rule_type"),
            "target_id": r.get("target_id", ""),
            "markup_pct": r.get("markup_pct"),
            "active": r.get("active", True),
            "start_date": r.get("start_date"),
            "end_date": r.get("end_date"),
            "created_at": r.get("created_at"),
        } for r in docs]

    @api.post("/admin/pricing-rules")
    async def admin_create_pricing_rule(payload: PricingRuleIn, admin: dict = Depends(require_admin)):
        if payload.rule_type not in ("global", "category", "subcategory", "vendor", "product"):
            raise HTTPException(status_code=400, detail="Invalid rule type")
        doc = payload.model_dump()
        doc["created_at"] = iso_now()
        doc["created_by"] = admin["id"]
        res = await db.pricing_rules.insert_one(doc)
        doc["_id"] = res.inserted_id
        await log_audit(db, actor_id=admin["id"], actor_role="admin", action="create_pricing_rule",
                        entity_type="pricing_rule", entity_id=str(res.inserted_id), new_value=doc)
        return {"id": str(res.inserted_id), **{k: v for k, v in doc.items() if k != "_id"}}

    @api.patch("/admin/pricing-rules/{rule_id}")
    async def admin_update_pricing_rule(rule_id: str, payload: dict, admin: dict = Depends(require_admin)):
        oid = safe_object_id(rule_id)
        allowed = {"markup_pct", "active", "start_date", "end_date", "target_id"}
        update = {k: v for k, v in payload.items() if k in allowed}
        if not update:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        await db.pricing_rules.update_one({"_id": oid}, {"$set": update})
        doc = await db.pricing_rules.find_one({"_id": oid})
        if not doc:
            raise HTTPException(status_code=404, detail="Rule not found")
        return {"id": str(doc["_id"]), **{k: doc.get(k) for k in ["rule_type", "target_id", "markup_pct", "active"]}}

    @api.delete("/admin/pricing-rules/{rule_id}")
    async def admin_delete_pricing_rule(rule_id: str, admin: dict = Depends(require_admin)):
        oid = safe_object_id(rule_id)
        await db.pricing_rules.delete_one({"_id": oid})
        return {"success": True}

    # ------------------------------------------------------------------
    # Admin: payouts
    # ------------------------------------------------------------------
    @api.get("/admin/payouts")
    async def admin_list_payouts(_: dict = Depends(require_admin), status: Optional[str] = None):
        q = {"status": status} if status else {}
        docs = await db.payouts.find(q).sort("created_at", -1).to_list(500)
        return [payout_to_out(p) for p in docs]

    @api.patch("/admin/payouts/{payout_id}/status")
    async def admin_update_payout_status(payout_id: str, payload: dict, admin: dict = Depends(require_admin)):
        status = payload.get("status")
        if status not in ("Approved", "Processing", "Paid", "Failed", "Rejected"):
            raise HTTPException(status_code=400, detail="Invalid payout status")
        oid = safe_object_id(payout_id)
        payout = await db.payouts.find_one({"_id": oid})
        if not payout:
            raise HTTPException(status_code=404, detail="Payout not found")

        update = {"status": status}
        if status == "Paid":
            update["processed_at"] = iso_now()
            update["transaction_reference"] = payload.get("transaction_reference", "")
            await db.wallet_transactions.insert_one({
                "vendor_id": payout["vendor_id"],
                "transaction_type": "payout",
                "amount": -float(payout["amount"]),
                "status": "completed",
                "reference_id": str(payout["_id"]),
                "description": f"Payout #{str(payout['_id'])[-6:].upper()}",
                "created_at": iso_now(),
            })
            vendor = await db.vendors.find_one({"_id": ObjectId(payout["vendor_id"])})
            if vendor and vendor.get("owner_id"):
                await create_notification(
                    db, user_id=vendor["owner_id"], role="vendor",
                    title="Payout completed",
                    body=f"₹{payout['amount']:.2f} has been transferred to your bank account.",
                    ntype="payout", link="/vendor/payouts",
                )
        elif status == "Rejected":
            update["notes"] = payload.get("notes", "")

        await db.payouts.update_one({"_id": oid}, {"$set": update})
        await log_audit(db, actor_id=admin["id"], actor_role="admin", action=f"payout_{status.lower()}",
                        entity_type="payout", entity_id=str(oid), previous_value=payout.get("status"), new_value=status)
        doc = await db.payouts.find_one({"_id": oid})
        return payout_to_out(doc)

    # ------------------------------------------------------------------
    # Admin: audit logs
    # ------------------------------------------------------------------
    @api.get("/admin/audit-logs")
    async def admin_audit_logs(_: dict = Depends(require_admin), limit: int = 100):
        docs = await db.audit_logs.find({}).sort("created_at", -1).limit(limit).to_list(limit)
        return [{
            "id": str(a["_id"]),
            "actor_id": a.get("actor_id"),
            "actor_role": a.get("actor_role"),
            "action": a.get("action"),
            "entity_type": a.get("entity_type"),
            "entity_id": a.get("entity_id"),
            "previous_value": a.get("previous_value"),
            "new_value": a.get("new_value"),
            "created_at": a.get("created_at"),
        } for a in docs]

    # ------------------------------------------------------------------
    # Admin: wallet adjustment
    # ------------------------------------------------------------------
    @api.post("/admin/vendors/{vendor_id}/wallet-adjustment")
    async def admin_wallet_adjustment(vendor_id: str, payload: dict, admin: dict = Depends(require_admin)):
        amount = float(payload.get("amount", 0))
        reason = payload.get("reason", "Manual adjustment")
        if amount == 0:
            raise HTTPException(status_code=400, detail="Amount cannot be zero")
        oid = safe_object_id(vendor_id)
        vendor = await db.vendors.find_one({"_id": oid})
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        await db.wallet_transactions.insert_one({
            "vendor_id": str(oid),
            "transaction_type": "manual_adjustment",
            "amount": amount,
            "status": "completed",
            "description": reason,
            "created_at": iso_now(),
            "created_by": admin["id"],
        })
        await log_audit(db, actor_id=admin["id"], actor_role="admin", action="wallet_adjustment",
                        entity_type="vendor", entity_id=vendor_id, new_value={"amount": amount, "reason": reason})
        return {"success": True, "wallet": await get_wallet_summary(db, str(oid))}

    # ------------------------------------------------------------------
    # Public: pricing preview (for checkout sync)
    # ------------------------------------------------------------------
    @api.get("/pricing/settings")
    async def public_pricing_settings():
        s = await get_platform_settings(db)
        return {
            "global_markup_pct": s.get("global_markup_pct"),
            "gst_rate": s.get("gst_rate"),
            "platform_fee": s.get("platform_fee"),
            "free_delivery_threshold": s.get("free_delivery_threshold"),
            "delivery_near_km": s.get("delivery_near_km"),
            "delivery_near_fee": s.get("delivery_near_fee"),
            "delivery_per_km": s.get("delivery_per_km"),
        }

    return {
        "process_referral_on_approval": process_referral_on_approval,
        "credit_vendor_order_earning": credit_vendor_order_earning,
        "release_pending_earnings": release_pending_earnings,
        "get_platform_settings": get_platform_settings,
        "enrich_product_for_customer": enrich_product_for_customer,
        "product_to_vendor_out": product_to_vendor_out,
    }
