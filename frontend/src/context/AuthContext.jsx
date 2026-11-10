import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = not-authed, undefined = loading
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem("ambajogai_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("ambajogai_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener(
      "ambajogai:session-expired",
      onSessionExpired
    );

    return () => {
      window.removeEventListener(
        "ambajogai:session-expired",
        onSessionExpired
      );
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("ambajogai_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("ambajogai_token", data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  };

  const logout = () => {
    localStorage.removeItem("ambajogai_token");
    setUser(null);
  };

  const setUserDirect = (nextUser) => {
    setUser(nextUser);
  };

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return { ok: true, user: data };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, setUser: setUserDirect, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
