import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Browser ko previous scroll position restore karne se roko
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Instant top
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}