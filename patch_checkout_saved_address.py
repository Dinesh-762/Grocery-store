from pathlib import Path

path = Path("frontend/src/pages/Checkout.jsx")
text = path.read_text(encoding="utf-8")

# 1. Add saved-address state after serviceabilityMessage state
state_marker = '''  const [serviceabilityMessage, setServiceabilityMessage] =
    useState("");

'''

state_block = '''  const [serviceabilityMessage, setServiceabilityMessage] =
    useState("");

  /*
  |--------------------------------------------------------------------------
  | Saved Address
  |--------------------------------------------------------------------------
  */

  const [savedAddress, setSavedAddress] = useState(null);
  const [savedAddressLoading, setSavedAddressLoading] = useState(false);
  const [savedAddressBusy, setSavedAddressBusy] = useState(false);

'''

if "const [savedAddress, setSavedAddress]" not in text:
    if state_marker not in text:
        raise SystemExit("ERROR: serviceabilityMessage state marker not found.")
    text = text.replace(state_marker, state_block, 1)

# 2. Add load/save/delete functions before "Load store information"
functions_marker = '''  /*
  |--------------------------------------------------------------------------
  | Load store information
  |--------------------------------------------------------------------------
  */

'''

functions_block = '''  /*
  |--------------------------------------------------------------------------
  | Saved Address API
  |--------------------------------------------------------------------------
  */

  const loadSavedAddress = async () => {
    if (!user) return;

    setSavedAddressLoading(true);

    try {
      const { data } = await api.get("/auth/saved-address");

      if (data?.saved && data?.address) {
        setSavedAddress(data.address);

        setForm((current) => ({
          ...current,
          full_name: data.address.full_name ?? current.full_name,
          phone: data.address.phone ?? current.phone,
          line1: data.address.line1 ?? current.line1,
          landmark: data.address.landmark ?? current.landmark,
          area: data.address.area ?? current.area,
          pincode: data.address.pincode ?? current.pincode,
        }));

        if (
          data.address.latitude !== null &&
          data.address.latitude !== undefined &&
          data.address.longitude !== null &&
          data.address.longitude !== undefined
        ) {
          setLocation((current) => ({
            ...current,
            latitude: Number(data.address.latitude),
            longitude: Number(data.address.longitude),
          }));
        }
      } else {
        setSavedAddress(null);
      }
    } catch (err) {
      console.error("Failed to load saved address:", err);
    } finally {
      setSavedAddressLoading(false);
    }
  };

  const saveCurrentAddress = async () => {
    if (!user) {
      toast.error("Please login to save your address.");
      return;
    }

    if (
      !form.full_name.trim() ||
      !form.phone.trim() ||
      !form.line1.trim() ||
      !form.area.trim() ||
      !form.pincode.trim()
    ) {
      toast.error("Please complete your delivery address first.");
      return;
    }

    setSavedAddressBusy(true);

    try {
      const address = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        landmark: form.landmark.trim(),
        area: form.area.trim(),
        city: "Ambajogai",
        pincode: form.pincode.trim(),
        latitude:
          location.latitude !== null
            ? Number(location.latitude)
            : null,
        longitude:
          location.longitude !== null
            ? Number(location.longitude)
            : null,
      };

      const { data } = await api.put(
        "/auth/saved-address",
        address
      );

      setSavedAddress(data?.address ?? address);

      toast.success("Address saved successfully.");
    } catch (err) {
      console.error("Failed to save address:", err);
      toast.error(
        formatApiError(
          err,
          "Unable to save address. Please try again."
        )
      );
    } finally {
      setSavedAddressBusy(false);
    }
  };

  const deleteSavedAddress = async () => {
    if (!user) return;

    setSavedAddressBusy(true);

    try {
      await api.delete("/auth/saved-address");
      setSavedAddress(null);
      toast.success("Saved address deleted.");
    } catch (err) {
      console.error("Failed to delete saved address:", err);
      toast.error(
        formatApiError(
          err,
          "Unable to delete saved address."
        )
      );
    } finally {
      setSavedAddressBusy(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSavedAddress();
    } else {
      setSavedAddress(null);
    }
  }, [user?.id]);

''' + functions_marker

if "const loadSavedAddress = async" not in text:
    if functions_marker not in text:
        raise SystemExit("ERROR: Load store information marker not found.")
    text = text.replace(functions_marker, functions_block, 1)

# 3. Add Saved Address UI immediately before LOCATION
location_marker = '''            {/* LOCATION */}

'''

location_ui = '''            {/* SAVED ADDRESS */}

            <div className="mt-5 rounded-xl border border-[#1B4332]/20 bg-[#1B4332]/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <div className="font-semibold text-[#1B4332]">
                    Saved address
                  </div>

                  <p className="mt-1 text-xs text-[#4A4A4A]">
                    Save this address to use it automatically on your next checkout.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    onClick={saveCurrentAddress}
                    disabled={
                      savedAddressBusy ||
                      savedAddressLoading
                    }
                    className="rounded-full bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                  >
                    {savedAddressBusy
                      ? "Saving..."
                      : "Save address"}
                  </button>

                  {savedAddress && (
                    <button
                      type="button"
                      onClick={deleteSavedAddress}
                      disabled={savedAddressBusy}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete saved
                    </button>
                  )}

                </div>
              </div>

              {savedAddressLoading && (
                <div className="mt-3 text-xs text-[#4A4A4A]">
                  Loading saved address...
                </div>
              )}

              {savedAddress && !savedAddressLoading && (
                <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-[#4A4A4A]">
                  <div className="font-semibold text-[#1B4332]">
                    Saved address loaded
                  </div>

                  <div className="mt-1">
                    {savedAddress.line1}
                    {savedAddress.area
                      ? `, ${savedAddress.area}`
                      : ""}
                    {savedAddress.pincode
                      ? ` - ${savedAddress.pincode}`
                      : ""}
                  </div>
                </div>
              )}

            </div>

            {/* LOCATION */}

'''

if "Save address" not in text:
    if location_marker not in text:
        raise SystemExit("ERROR: LOCATION marker not found.")
    text = text.replace(location_marker, location_ui, 1)

path.write_text(text, encoding="utf-8")

print("Checkout saved-address integration added successfully.")
