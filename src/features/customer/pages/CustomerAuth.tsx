
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import "./CustomerAuth.css";

type AuthMode = "login" | "register" | "forgot";

export default function CustomerAuth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      // FORGOT PASSWORD
      if (mode === "forgot") {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/account/update-password`,
          });

        if (resetError) throw resetError;

        setMessage(
          "If an account exists with this email, a password reset link will be sent."
        );
        return;
      }

      // CREATE ACCOUNT
      if (mode === "register") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                phone: phone.trim(),
              },
            },
          });

        if (signUpError) throw signUpError;

        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setMessage(
            "Your account has been created. Please check your email to confirm your account before logging in."
          );
          setMode("login");
          setPassword("");
        }

        return;
      }

      // CUSTOMER LOGIN
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) throw loginError;

      if (data.user?.app_metadata?.role === "admin") {
        await supabase.auth.signOut();
        throw new Error("Please use the administrator login page.");
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-auth-page">
      <header className="customer-auth-header">
        <Link to="/" className="customer-auth-logo">
          999<span>+</span> KART
        </Link>

        <Link to="/" className="customer-auth-back">
          ← Back to shop
        </Link>
      </header>

      <main className="customer-auth-container">
        <section className="customer-auth-card">
          <div className="customer-auth-brand">
            <span>999+</span>
          </div>

          <p className="customer-auth-eyebrow">
            WELCOME TO 999+ KART
          </p>

          <h1>
            {mode === "login"
              ? "Welcome back!"
              : mode === "register"
                ? "Create your account"
                : "Reset your password"}
          </h1>

          <p className="customer-auth-subtitle">
            {mode === "login"
              ? "Sign in to continue your shopping journey."
              : mode === "register"
                ? "Join us and discover something you'll love."
                : "Enter your registered email address and we'll send you a password reset link."}
          </p>

          {mode !== "forgot" && (
            <div className="customer-auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "selected" : ""}
                onClick={() => {
                  setMode("login");
                  clearMessages();
                }}
              >
                LOGIN
              </button>

              <button
                type="button"
                className={mode === "register" ? "selected" : ""}
                onClick={() => {
                  setMode("register");
                  clearMessages();
                }}
              >
                CREATE ACCOUNT
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <label htmlFor="customer-name">Full name</label>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />

                <label htmlFor="customer-phone">Phone number</label>
                <input
                  id="customer-phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  pattern="[0-9+\-\s]{10,15}"
                  title="Enter a valid phone number"
                  required
                />
              </>
            )}

            <label htmlFor="customer-email">Email address</label>
            <input
              id="customer-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            {mode !== "forgot" && (
              <>
                <label htmlFor="customer-password">Password</label>
                <input
                  id="customer-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={6}
                  required
                />
              </>
            )}

            {mode === "login" && (
              <div className="customer-auth-forgot">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    clearMessages();
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && (
              <div className="customer-auth-error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="customer-auth-success" role="status">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="customer-auth-submit"
              disabled={loading}
            >
              {loading
                ? "PLEASE WAIT..."
                : mode === "login"
                  ? "SIGN IN"
                  : mode === "register"
                    ? "CREATE ACCOUNT"
                    : "SEND RESET LINK"}
            </button>
          </form>

          <p className="customer-auth-switch">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  clearMessages();
                }}
              >
                ← Back to Login
              </button>
            ) : (
              <>
                {mode === "login"
                  ? "New to 999+ KART? "
                  : "Already have an account? "}

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "login" ? "register" : "login");
                    clearMessages();
                  }}
                >
                  {mode === "login"
                    ? "Create an account"
                    : "Sign in"}
                </button>
              </>
            )}
          </p>
        </section>
      </main>

      <footer className="customer-auth-footer">
        © 2026 999+ KART. All rights reserved.
      </footer>
    </div>
  );
}
