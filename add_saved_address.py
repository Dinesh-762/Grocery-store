from pathlib import Path

path = Path("backend/server.py")
text = path.read_text(encoding="utf-8")

marker = '@api.get("/auth/me", response_model=UserOut)'

if '@api.get("/auth/saved-address")' in text:
    print("Saved Address API already exists. No changes made.")
elif marker not in text:
    print("ERROR: /auth/me marker not found. No changes made.")
else:
    block = '''
# ---------------------------------------------------------------------------
# SAVED ADDRESS
# ---------------------------------------------------------------------------

@api.get("/auth/saved-address")
async def get_saved_address(
    user: dict = Depends(get_current_user),
):
    """Return the saved delivery address for the currently logged-in user."""
    saved = await db.saved_addresses.find_one(
        {"user_id": user["id"]},
        {"_id": 0},
    )

    return {
        "saved": bool(saved),
        "address": saved.get("address") if saved else None,
    }


@api.put("/auth/saved-address")
async def save_address(
    address: AddressIn,
    user: dict = Depends(get_current_user),
):
    """Create or replace the saved delivery address for the current user."""
    await db.saved_addresses.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                "user_id": user["id"],
                "address": address.model_dump(),
                "updated_at": iso_now(),
            }
        },
        upsert=True,
    )

    return {
        "success": True,
        "message": "Address saved successfully.",
        "address": address.model_dump(),
    }


@api.delete("/auth/saved-address")
async def delete_saved_address(
    user: dict = Depends(get_current_user),
):
    """Delete the saved delivery address for the current user."""
    result = await db.saved_addresses.delete_one(
        {"user_id": user["id"]}
    )

    return {
        "success": True,
        "deleted": result.deleted_count > 0,
    }


'''
    text = text.replace(marker, block + marker, 1)
    path.write_text(text, encoding="utf-8")
    print("Saved Address API added successfully.")
