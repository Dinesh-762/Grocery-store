from pathlib import Path

path = Path("frontend/src/pages/DeliveryPanel.jsx")
text = path.read_text(encoding="utf-8")

if 'from "@/lib/audioAlert"' not in text:
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

        audioRef.current.volume = 1.0;
        audioRef.current.preload = "auto";
      }

      audioRef.current.currentTime = 0;

      const playPromise = audioRef.current.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Browser may block autoplay until the delivery partner
          // interacts with the page.
        });
      }
    } catch (error) {
      console.error("New order ringtone error:", error);
    }
  }, []);'''

new = '''  const playNewOrderSound = useCallback(() => {
    playCheckoutBell();
  }, []);'''

if old not in text:
    print("WARNING: Delivery old ringtone block not found.")
else:
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("Delivery ringtone changed to grocery checkout bell.")
