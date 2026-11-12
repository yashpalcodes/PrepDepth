import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./components/RequireAuth";
import Add from "./pages/Add";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Review from "./pages/Review";
import Today from "./pages/Today";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Today />} />
            <Route path="/review" element={<Review />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/add" element={<Add />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
