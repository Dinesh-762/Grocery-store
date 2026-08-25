from pathlib import Path

path = Path("frontend/src/pages/DeliveryPanel.jsx")
text = path.read_text(encoding="utf-8")

# Remove wrongly inserted import
text = text.replace('import {\nimport { playCheckoutBell } from "@/lib/audioAlert";', 'import {')

# Add the correct import before the first existing import
if 'import { playCheckoutBell } from "@/lib/audioAlert";' not in text:
    text = 'import { playCheckoutBell } from "@/lib/audioAlert";\n' + text

path.write_text(text, encoding="utf-8")

print("DeliveryPanel import fixed successfully.")
