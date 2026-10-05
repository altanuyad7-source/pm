"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

export function AuthenticatedApp() {
  const [status, setStatus] = useState<"loading" | "signed-out" | "signed-in">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const expired = useCallback(() => {
    setStatus("signed-out");
    setError("Your session expired. Please sign in again.");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/session")
      .then((response) => {
        if (!response.ok && response.status !== 401) throw new Error("Unable to check your session. Reload to try again.");
        if (active) setStatus(response.ok ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (active) {
          setStatus("signed-out");
          setError("Unable to check your session. Reload to try again.");
        }
      });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Invalid username or password." : "Unable to sign in. Try again.");
      setStatus("signed-in");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to sign in. Try again.");
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out. Try again.");
      setStatus("signed-out");
    } catch {
      setError("Unable to sign out. Try again.");
    } finally { setBusy(false); }
  }

  if (status === "loading") return <p role="status" className="p-8">Checking session...</p>;

  if (status === "signed-in") return (
    <>
      <div className="flex items-center justify-end gap-4 px-6 pt-4">
        {error && <p role="alert">{error}</p>}
        <button className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-white" onClick={logout} disabled={busy}>Sign out</button>
      </div>
      <KanbanBoard onUnauthorized={expired} />
    </>
  );

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={login} className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-8 shadow-[var(--shadow)]">
        <h1 className="font-display text-3xl text-[var(--navy-dark)]">Sign in</h1>
        <p className="text-sm text-[var(--gray-text)]">Local demo: user / password</p>
        <label className="block">Username<input name="username" autoComplete="username" required className="mt-2 block w-full rounded-lg border p-2" /></label>
        <label className="block">Password<input name="password" type="password" autoComplete="current-password" required className="mt-2 block w-full rounded-lg border p-2" /></label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy} className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-white">{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
