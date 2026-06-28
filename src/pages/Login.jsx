import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");

  if (loading) return <div className="auth-status">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSignIn() {
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("Sign-in failed. Please try again.");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo">ATSS</div>
        <h1 className="sec-title" style={{ fontSize: "1.8rem", marginTop: 12, marginBottom: 8 }}>
          Logistics Dashboard
        </h1>
        <p className="login-sub">Sign in with your Google account to manage shipments.</p>
        <button className="btn-send" type="button" onClick={handleSignIn}>
          Sign in with Google
        </button>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  );
}
