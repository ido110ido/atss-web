import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, isActive, signOutUser } = useAuth();

  if (loading) {
    return <div className="auth-status">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isActive) {
    return (
      <div className="auth-status">
        <p>
          This account ({user.email}) doesn&apos;t have access yet
          {profile ? " (deactivated)" : ""}. Ask your admin to enable it.
        </p>
        <button className="btn-send" type="button" onClick={signOutUser}>
          Sign out
        </button>
      </div>
    );
  }

  return children;
}
