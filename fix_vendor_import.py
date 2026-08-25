from pathlib import Path

path = Path("frontend/src/pages/VendorDashboard.jsx")
text = path.read_text(encoding="utf-8")

# Remove wrongly nested import
text = text.replace(
    'import {\nimport { playCheckoutBell } from "@/lib/audioAlert";',
    'import {'
)

# Ensure correct standalone import exists
if 'import { playCheckoutBell } from "@/lib/audioAlert";' not in text:
    text = 'import { playCheckoutBell } from "@/lib/audioAlert";\n' + text

path.write_text(text, encoding="utf-8")

print("VendorDashboard import fixed successfully.")
