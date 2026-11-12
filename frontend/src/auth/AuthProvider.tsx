import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, loadSession, saveSession, UNAUTHORIZED_EVENT, type Session } from "../api/client";
import type { AuthResponse } from "../api/types";
import { AuthContext, type AuthValue } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  // If any request gets a 401, the client clears storage and fires this event.
  useEffect(() => {
    const onUnauthorized = () => setSession(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const authenticate = useCallback(async (path: string, email: string, password: string) => {
    const res = await api<AuthResponse>(path, { method: "POST", body: { email, password } });
    const next: Session = { token: res.token, email: res.user.email };
    saveSession(next);
    setSession(next);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      login: (email, password) => authenticate("/auth/login", email, password),
      register: (email, password) => authenticate("/auth/register", email, password),
      logout: () => {
        clearSession();
        setSession(null);
      },
    }),
    [session, authenticate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
