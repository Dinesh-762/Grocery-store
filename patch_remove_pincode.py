from pathlib import Path

path = Path("backend/server.py")
text = path.read_text(encoding="utf-8")

old = '''    if delivery_settings["allowed_pincodes"] and normalized_order_pincode not in delivery_settings["allowed_pincodes"]:
        raise HTTPException(
            status_code=400,
            detail=f"Sorry! Ambajogai Grocery Store currently delivers only in the {delivery_settings['service_area']} area.",
        )
'''

if old in text:
    text = text.replace(old, "")
    path.write_text(text, encoding="utf-8")
    print("SUCCESS: Pincode restriction removed.")
else:
    print("Pincode restriction block not found - no changes made.")
