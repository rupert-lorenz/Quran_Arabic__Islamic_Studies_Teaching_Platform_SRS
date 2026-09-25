"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto w-full max-w-md rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const form = new FormData(event.currentTarget);
        try {
          const result = await postJson<{
            twoFactor?: { required: boolean };
          }>("/api/v1/setup/super-admin", {
            displayName: String(form.get("displayName") ?? ""),
            email: String(form.get("email") ?? ""),
            password: String(form.get("password") ?? ""),
          });
          router.push(
            result.twoFactor?.required ? "/login/two-factor" : "/staff",
          );
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create Super Admin");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold text-brand">Create Super Admin</h1>
      <p className="mt-2 text-sm text-muted">
        This first privileged account owns the platform. After you save, set up
        an authenticator before opening staff tools.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-bold text-brand">Full name</span>
        <input
          name="displayName"
          autoComplete="name"
          required
          minLength={2}
          className={fieldClass}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          Password
        </span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={fieldClass}
        />
      </label>
      <p className="mt-2 text-xs font-semibold text-muted">
        At least 10 characters, with a letter and a number.
      </p>
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? "Creating…" : "Create Super Admin"}
      </Button>
    </form>
  );
}
