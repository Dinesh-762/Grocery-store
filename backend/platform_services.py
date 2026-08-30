"""Wallet, payouts, referrals, notifications, and audit log services."""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from bson import ObjectId


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_referral_code(length: int = 8) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


async def log_audit(
    db,
    *,
    actor_id: str,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str = "",
    previous_value: Any = None,
    new_value: Any = None,
    ip: Optional[str] = None,
) -> None:
    await db.audit_logs.insert_one({
        "actor_id": actor_id,
        "actor_role": actor_role,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "previous_value": previous_value,
        "new_value": new_value,
        "ip": ip,
        "created_at": iso_now(),
    })


async def create_notification(
    db,
    *,
    user_id: str,
    role: str,
    title: str,
    body: str,
    ntype: str = "info",
    link: Optional[str] = None,
) -> None:
    await db.notifications.insert_one({
        "user_id": user_id,
        "role": role,
        "title": title,
        "body": body,
        "type": ntype,
        "link": link,
        "read": False,
        "created_at": iso_now(),
    })


async def get_wallet_summary(db, vendor_id: str) -> dict:
    txs = await db.wallet_transactions.find({"vendor_id": vendor_id}).sort("created_at", -1).to_list(5000)
    available = 0.0
    pending = 0.0
    referral = 0.0
    paid_out = 0.0
    platform_fees = 0.0
    refunds = 0.0

    for t in txs:
        amt = float(t.get("amount") or 0)
        ttype = t.get("transaction_type", "")
        status = t.get("status", "completed")
        if ttype == "order_earning":
            if status == "pending":
                pending += amt
            elif status == "completed":
                available += amt
        elif ttype == "referral_reward" and status == "completed":
            referral += amt
            available += amt
        elif ttype == "payout" and status == "completed":
            paid_out += abs(amt)
            available += amt  # negative amount
        elif ttype == "platform_deduction":
            platform_fees += abs(amt)
        elif ttype == "refund_adjustment":
            refunds += abs(amt)
            available -= abs(amt)
        elif ttype == "manual_adjustment" and status == "completed":
            available += amt

    # Subtract pending payouts
    pending_payouts = await db.payouts.find({
        "vendor_id": vendor_id,
        "status": {"$in": ["Pending", "Approved", "Processing"]},
    }).to_list(100)
    pending_payout_total = sum(float(p.get("amount") or 0) for p in pending_payouts)

    return {
        "available_balance": round(max(0, available - pending_payout_total), 2),
        "pending_balance": round(pending, 2),
        "referral_earnings": round(referral, 2),
        "total_paid_out": round(paid_out, 2),
        "platform_fees": round(platform_fees, 2),
        "refund_deductions": round(refunds, 2),
        "total_earnings": round(available + paid_out + pending, 2),
        "pending_payout": round(pending_payout_total, 2),
    }


async def credit_vendor_order_earning(
    db,
    *,
    vendor_id: str,
    order_id: str,
    line_items: list[dict],
    commission_pct: float,
    settlement_days: int = 7,
) -> None:
    """Credit vendor wallet when order lines are delivered."""
    for item in line_items:
        snap = item.get("pricing_snapshot") or {}
        base = float(snap.get("base_price") or item.get("base_price") or 0)
        qty = int(item.get("quantity") or 0)
        gross = round(base * qty, 2)
        commission = round(gross * commission_pct / 100.0, 2)
        net = round(gross - commission, 2)
        if net <= 0:
            continue

        existing = await db.wallet_transactions.find_one({
            "vendor_id": vendor_id,
            "reference_id": order_id,
            "product_id": item.get("product_id"),
            "transaction_type": "order_earning",
        })
        if existing:
            continue

        release_at = (datetime.now(timezone.utc) + timedelta(days=settlement_days)).isoformat()
        await db.wallet_transactions.insert_one({
            "vendor_id": vendor_id,
            "transaction_type": "order_earning",
            "amount": net,
            "gross_amount": gross,
            "commission": commission,
            "commission_pct": commission_pct,
            "status": "pending",
            "reference_id": order_id,
            "product_id": item.get("product_id"),
            "description": f"Order #{order_id[-6:].upper()} — {item.get('name', 'item')}",
            "release_at": release_at,
            "created_at": iso_now(),
        })

        if commission > 0:
            await db.wallet_transactions.insert_one({
                "vendor_id": vendor_id,
                "transaction_type": "platform_deduction",
                "amount": -commission,
                "status": "completed",
                "reference_id": order_id,
                "product_id": item.get("product_id"),
                "description": f"Platform commission ({commission_pct}%)",
                "created_at": iso_now(),
            })


async def release_pending_earnings(db, vendor_id: Optional[str] = None) -> int:
    """Move pending earnings past settlement period to available."""
    now = iso_now()
    q: dict = {"transaction_type": "order_earning", "status": "pending", "release_at": {"$lte": now}}
    if vendor_id:
        q["vendor_id"] = vendor_id
    result = await db.wallet_transactions.update_many(q, {"$set": {"status": "completed"}})
    return result.modified_count


async def process_referral_on_approval(db, vendor: dict, settings: dict) -> None:
    """Reward referrer when referred vendor gets approved."""
    referrer_code = vendor.get("referred_by_code")
    if not referrer_code:
        return

    referrer = await db.vendors.find_one({"referral_code": referrer_code})
    if not referrer:
        return

    reward = float(settings.get("referral_reward_amount", 500))
    ref_id = str(vendor["_id"])
    existing = await db.referrals.find_one({"referred_vendor_id": ref_id})
    if existing and existing.get("status") == "paid":
        return

    await db.referrals.update_one(
        {"referred_vendor_id": ref_id},
        {"$set": {
            "referrer_vendor_id": str(referrer["_id"]),
            "referrer_code": referrer_code,
            "status": "approved",
            "reward_amount": reward,
            "approved_at": iso_now(),
        }},
        upsert=True,
    )

    await db.wallet_transactions.insert_one({
        "vendor_id": str(referrer["_id"]),
        "transaction_type": "referral_reward",
        "amount": reward,
        "status": "completed",
        "reference_id": ref_id,
        "description": f"Referral reward — {vendor.get('business_name', 'new vendor')}",
        "created_at": iso_now(),
    })

    await db.referrals.update_one(
        {"referred_vendor_id": ref_id},
        {"$set": {"status": "paid", "paid_at": iso_now()}},
    )

    owner_id = referrer.get("owner_id")
    if owner_id:
        await create_notification(
            db,
            user_id=owner_id,
            role="vendor",
            title="Referral reward earned!",
            body=f"You earned ₹{reward:.0f} for referring {vendor.get('business_name', 'a vendor')}.",
            ntype="referral",
            link="/vendor/refer",
        )


def payout_to_out(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "vendor_id": p.get("vendor_id"),
        "vendor_name": p.get("vendor_name", ""),
        "amount": p.get("amount"),
        "status": p.get("status"),
        "payment_method": p.get("payment_method", "bank_transfer"),
        "transaction_reference": p.get("transaction_reference", ""),
        "bank_account": p.get("bank_account", {}),
        "notes": p.get("notes", ""),
        "created_at": p.get("created_at"),
        "processed_at": p.get("processed_at"),
    }


def wallet_tx_to_out(t: dict, *, vendor_view: bool = False) -> dict:
    out = {
        "id": str(t["_id"]),
        "vendor_id": t.get("vendor_id"),
        "transaction_type": t.get("transaction_type"),
        "amount": t.get("amount"),
        "status": t.get("status"),
        "reference_id": t.get("reference_id"),
        "description": t.get("description", ""),
        "created_at": t.get("created_at"),
        "release_at": t.get("release_at"),
    }
    if not vendor_view:
        out["gross_amount"] = t.get("gross_amount")
        out["commission"] = t.get("commission")
    elif t.get("transaction_type") == "order_earning" and t.get("gross_amount"):
        # Vendor sees their listed product total, not platform markup or fee breakdown.
        out["amount"] = t.get("gross_amount")
    return out
