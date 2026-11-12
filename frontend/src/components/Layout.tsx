import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/authContext";

export function Layout() {
  const { session, logout } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">PrepDebt</span>
        <nav>
          <NavLink to="/" end>
            Today
          </NavLink>
        </nav>
        <div className="spacer" />
        <span className="muted small">{session?.email}</span>
        <button className="btn ghost" onClick={logout}>
          Log out
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
