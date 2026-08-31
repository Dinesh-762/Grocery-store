import { useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { FolderOpen, Camera, Link2, Cloud, Loader2, Upload } from "lucide-react";

const MODES = [
  { id: "file", label: "Files", icon: FolderOpen, hint: "Choose an image saved on this device." },
  { id: "camera", label: "Camera", icon: Camera, hint: "Take a new photo with your device camera." },
  { id: "drive", label: "Drive", icon: Cloud, hint: "Pick from Google Drive, OneDrive, or other cloud storage in the file picker." },
  { id: "url", label: "URL", icon: Link2, hint: "Paste a direct public image link (https://…)." },
];

export function ImageSourcePicker({
  value,
  onChange,
  label = "Image",
  required = false,
  testIdPrefix = "image",
}) {
  const [mode, setMode] = useState(value?.startsWith("http") ? "url" : "file");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const driveRef = useRef(null);

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);

    try {
      setUploading(true);
      const res = await api.post("/upload/image", fd);
      onChange(res.data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(formatApiError(e) || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    uploadFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const openPicker = () => {
    if (mode === "camera") cameraRef.current?.click();
    else if (mode === "drive") driveRef.current?.click();
    else fileRef.current?.click();
  };

  return (
    <div data-testid={`${testIdPrefix}-picker`}>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
        {label}
        {required ? " *" : ""}
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map(({ id, label: modeLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === id
                ? "border-[#1B4332] bg-[#1B4332] text-white"
                : "border-[#D9E8DE] bg-white text-[#4A4A4A] hover:border-[#1B4332]/40"
            }`}
            data-testid={`${testIdPrefix}-mode-${id}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {modeLabel}
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        data-testid={`${testIdPrefix}-file-input`}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        data-testid={`${testIdPrefix}-camera-input`}
      />
      <input
        ref={driveRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        data-testid={`${testIdPrefix}-drive-input`}
      />

      {mode === "url" ? (
        <input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/product.jpg"
          className="input-base"
          required={required}
          data-testid={`${testIdPrefix}-url`}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-[#D9E8DE] bg-[#F7FBF8] p-4">
          <p className="text-xs text-[#4A4A4A]">{activeMode.hint}</p>
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="btn-secondary mt-3 inline-flex items-center gap-2"
            data-testid={`${testIdPrefix}-browse`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {mode === "camera" ? "Open camera" : mode === "drive" ? "Browse cloud storage" : "Choose file"}
              </>
            )}
          </button>
        </div>
      )}

      {value ? (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={value}
            alt="Preview"
            className="h-24 w-24 rounded-lg border border-[#E5E5E5] object-cover"
            data-testid={`${testIdPrefix}-preview`}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-semibold text-red-600 hover:underline"
            data-testid={`${testIdPrefix}-clear`}
          >
            Remove image
          </button>
        </div>
      ) : null}
    </div>
  );
}
