import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";

export default function Login() {
  const { session, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (mode === "login" ? login(email, password) : register(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
    // On success the provider sets the session and this component redirects.
  }

  const isLogin = mode === "login";

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>PrepDebt</h1>
        <p className="muted">Revise the coding problems you are about to forget.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            maxLength={72}
            required
          />
        </label>
        {!isLogin && <p className="muted small">At least 8 characters.</p>}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Please wait..." : isLogin ? "Log in" : "Create account"}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError(null);
          }}
        >
          {isLogin ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
