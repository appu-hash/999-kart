import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck, KeyRound, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./CustomerSettings.css";

export default function CustomerSettings() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSending, setPasswordSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !data.user) {
        setError("Please sign in to manage your account settings.");
      } else {
        setCurrentEmail(data.user.email ?? "");
      }
      if (new URLSearchParams(window.location.search).get("email_change") === "verified") {
        setMessage("Your email change has been confirmed. If the address shown below has not refreshed, sign in again.");
      }
      setLoading(false);
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail === currentEmail.toLowerCase()) {
      setError("Please enter a different email address.");
      return;
    }

    setEmailSaving(true);
    const { error: updateError } = await supabase.auth.updateUser(
      { email: normalizedEmail },
      { emailRedirectTo: `${window.location.origin}/account/settings?email_change=verified` }
    );
    setEmailSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Email change requested. Open the verification email sent by Supabase and confirm the change. Your account email will not change until verification is completed.");
    setNewEmail("");
  }

  async function requestPasswordReset() {
    setError("");
    setMessage("");
    if (!currentEmail) {
      setError("We could not find an email address for this account. Please sign in again.");
      return;
    }

    setPasswordSending(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo: `${window.location.origin}/account/update-password`,
    });
    setPasswordSending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("If your account is eligible, a password reset link will be sent to your registered email. Open that email to verify your identity before choosing a new password.");
  }

  if (loading) {
    return <main className="customer-settings-page"><div className="customer-settings-card">Loading account settings...</div></main>;
  }

  return (
    <main className="customer-settings-page">
      <header className="customer-settings-header">
        <Link to="/" className="customer-settings-logo">999<span>+</span> KART</Link>
        <Link to="/account/dashboard" className="customer-settings-back"><ArrowLeft size={16} /> Back to My Account</Link>
      </header>

      <div className="customer-settings-main">
        <div className="customer-settings-intro">
          <p>ACCOUNT PREFERENCES</p>
          <h1>Settings</h1>
          <span>Manage your sign-in email and account security.</span>
        </div>

        {message && <div className="customer-settings-message" role="status"><CheckCircle2 size={18} />{message}</div>}
        {error && <div className="customer-settings-error" role="alert">{error}</div>}

        <section className="customer-settings-card">
          <div className="customer-settings-card-heading">
            <span className="customer-settings-icon"><Mail /></span>
            <div><h2>Email address</h2><p>Verify a new email before it becomes your sign-in address.</p></div>
          </div>
          <form onSubmit={requestEmailChange} className="customer-settings-form">
            <label>Current email address<input type="email" value={currentEmail} readOnly /></label>
            <label>New email address<input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Enter your new email address" autoComplete="email" required /></label>
            <button type="submit" disabled={emailSaving}>{emailSaving ? "SENDING VERIFICATION..." : "REQUEST EMAIL CHANGE"}</button>
          </form>
          <p className="customer-settings-note"><ShieldCheck size={15} /> The new address is not applied until the email verification process is completed. Depending on your Supabase Auth settings, confirmation may be required from both email addresses.</p>
        </section>

        <section className="customer-settings-card">
          <div className="customer-settings-card-heading">
            <span className="customer-settings-icon"><KeyRound /></span>
            <div><h2>Password</h2><p>Password changes are handled through a verified recovery link.</p></div>
          </div>
          <div className="customer-settings-password-row">
            <div><strong>Reset your password</strong><span>We'll send a secure reset link to {currentEmail || "your registered email"}.</span></div>
            <button type="button" onClick={requestPasswordReset} disabled={passwordSending}>{passwordSending ? "SENDING..." : "SEND RESET LINK"}</button>
          </div>
          <p className="customer-settings-note"><ShieldCheck size={15} /> You must open the email link and verify your account before setting a new password. There is no direct password-change form on this page.</p>
        </section>
      </div>
    </main>
  );
}
