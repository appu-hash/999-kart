import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./UpdatePassword.css";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // Only the PASSWORD_RECOVERY auth event grants access to this form.
    // A normal signed-in session alone is not sufficient.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryVerified(true);
        setChecking(false);
      }
    });

    // If the page was opened without a recovery callback, do not allow
    // a password update just because a normal session exists.
    const timeout = window.setTimeout(() => setChecking(false), 1800);

    return () => {
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!recoveryVerified) {
      setError("Please open the password reset link from your email first.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Your password has been reset successfully. You can now continue to your account.");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="update-password-page">
      <header className="update-password-header">
        <Link to="/" className="customer-auth-logo">999<span>+</span> KART</Link>
        <Link to="/account" className="customer-auth-back">← Back to login</Link>
      </header>
      <section className="update-password-card">
        <div className="update-password-icon"><LockKeyhole /></div>
        <p className="update-password-eyebrow">ACCOUNT SECURITY</p>
        <h1>Set a new password</h1>
        <p className="update-password-subtitle">Verify your password reset email, then choose a new password.</p>

        {checking ? (
          <p className="update-password-info">Verifying your password reset link...</p>
        ) : !recoveryVerified ? (
          <div className="update-password-error" role="alert">
            This page can only be used after opening a valid password reset link from your email. Request a new link from the login page.
            <Link to="/account">Return to login</Link>
          </div>
        ) : success ? (
          <div className="update-password-success" role="status">
            <CheckCircle2 />
            <p>{success}</p>
            <button type="button" onClick={() => navigate("/account/dashboard", { replace: true })}>CONTINUE TO ACCOUNT</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="update-password-form">
            <label>
              New password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            <label>
              Confirm new password
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required />
            </label>
            {error && <div className="update-password-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading}>{loading ? "UPDATING..." : "UPDATE PASSWORD"}</button>
          </form>
        )}
      </section>
      <footer className="update-password-footer">© 2026 999+ KART. All rights reserved.</footer>
    </main>
  );
}
