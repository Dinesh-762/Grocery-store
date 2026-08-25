// Haversine distance in km between two lat/lng points
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Reverse-geocode via OpenStreetMap Nominatim (no key). Returns { area, pincode, line1 }.
export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = await res.json();
  const a = data.address || {};
  return {
    area: a.suburb || a.neighbourhood || a.locality || a.village || a.town || a.city_district || a.hamlet || "",
    pincode: a.postcode || "",
    line1: [a.house_number, a.road].filter(Boolean).join(" "),
    display_name: data.display_name || "",
  };
}
