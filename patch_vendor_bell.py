from pathlib import Path

path = Path("frontend/src/pages/VendorDashboard.jsx")
text = path.read_text(encoding="utf-8")

if 'from "@/lib/audioAlert"' not in text:
    # Add import after existing imports
    lines = text.splitlines()
    insert_at = 0

    for i, line in enumerate(lines):
        if line.startswith("import "):
            insert_at = i + 1

    lines.insert(insert_at, 'import { playCheckoutBell } from "@/lib/audioAlert";')
    text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")

old = '''  const playNewOrderSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        );
        audioRef.current.volume = 1;
      }

      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Browser may block autoplay until user interacts with the page.
      });
    } catch (e) {
      console.error("Order ringtone error:", e);
    }
  }, []);'''

new = '''  const playNewOrderSound = useCallback(() => {
    playCheckoutBell();
  }, []);'''

if old not in text:
    print("WARNING: Vendor old ringtone block not found.")
else:
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("Vendor ringtone changed to grocery checkout bell.")
