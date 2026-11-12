import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { Layout } from "./Layout";

/** Shows the app shell for logged-in users, otherwise sends them to /login. */
export function RequireAuth() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <Layout />;
}
