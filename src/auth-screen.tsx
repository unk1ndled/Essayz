import { useState, type FormEvent } from "react";
import { api } from "./api";
import type { User } from "./types";

type AuthMode = "login" | "register";

export function AuthScreen({ inviteToken, onAuthenticated }: { inviteToken: string; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>(inviteToken ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = mode === "login"
        ? await api.login(form.username, form.password)
        : await api.register({ ...form, inviteToken });
      onAuthenticated(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-page">
        <header className="auth-intro">
          <h1>Essayz</h1>
          <p>A private weekly writing circle.</p>
        </header>
        <section className="auth-panel">
          <h2>{mode === "login" ? "Sign in" : "Join the circle"}</h2>
          <p className="auth-copy">
            {mode === "register"
              ? "Your invitation is ready. Choose your name and begin writing with the circle."
              : "Write privately through the week. Submitted essays open for everyone on Sunday at 10:00."}
          </p>
          <div className="auth-tabs" role="tablist">
            <button aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
            {inviteToken && <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>}
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                Your name
                <input required maxLength={50} autoComplete="name" placeholder="Ada Lovelace" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </label>
            )}
            <label>
              Username
              <input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_-]{3,24}" title="3–24 letters, numbers, underscores, or hyphens" autoCapitalize="none" autoComplete="username" placeholder="ada" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            </label>
            <label>
              Password
              <input required minLength={10} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 10 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button wide" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Enter Essayz" : "Create my account"}</button>
          </form>
          <p className="auth-note">{inviteToken ? "Invitation links work once and expire after seven days." : "Need an account? Ask a circle member for an invitation link."}</p>
        </section>
      </div>
    </main>
  );
}
