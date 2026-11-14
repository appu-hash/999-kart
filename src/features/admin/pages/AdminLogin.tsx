
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import "./AdminLogin.css";

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        await supabase.auth.signOut();
        throw new Error("Unable to verify your account.");
      }

      if (userData.user.app_metadata?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin account required.");
      }

      onLogin();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <a href="/" className="admin-brand">
          999<span>+</span> KART
        </a>

        <div className="admin-login-heading">
          <p className="admin-eyebrow">ADMINISTRATION</p>
          <h1>Welcome back.</h1>
          <p>Sign in to manage your store.</p>
        </div>

        <form onSubmit={handleLogin}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "VERIFYING..." : "SIGN IN TO DASHBOARD"}
          </button>
        </form>

        <p className="admin-login-footer">
          Restricted access · Authorized administrators only
        </p>

       <a href="/account" className="admin-back-link">
  ← Customer Login
</a>
      </div>
    </div>
  );
}
