import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ambajogai_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const path = window.location.pathname;

      if (
        path.startsWith("/checkout") ||
        path.startsWith("/orders") ||
        path.startsWith("/admin") ||
        path.startsWith("/profile")
      ) {
        localStorage.removeItem("ambajogai_token");
      }
    }

    return Promise.reject(err);
  }
);

export function formatApiError(
  err,
  fallback = "Something went wrong. Please try again."
) {
  const detail = err?.response?.data?.detail;

  if (!detail) {
    return err?.message || fallback;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((e) =>
        e && typeof e.msg === "string"
          ? e.msg
          : JSON.stringify(e)
      )
      .join(" ");
  }

  if (detail && typeof detail.msg === "string") {
    return detail.msg;
  }

  return String(detail);
}

export function formatINR(n) {
  const v = Number(n || 0);

  return `₹${v
    .toFixed(2)
    .replace(/\.00$/, "")}`;
}