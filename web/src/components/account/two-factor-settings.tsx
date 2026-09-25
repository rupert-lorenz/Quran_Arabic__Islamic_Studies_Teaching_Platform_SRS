"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";

type Setup = {
  secret: string;
  qrDataUrl: string;
};

export function TwoFactorSettings({
  required,
  enabled,
  remainingRecoveryCodes,
}: {
  required: boolean;
  enabled: boolean;
  remainingRecoveryCodes: number;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (!required) {
    return (
      <p className="text-sm text-muted">
        Authenticator apps are required for staff accounts only.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {enabled
          ? `Authenticator is on. ${remainingRecoveryCodes} unused recovery codes remain.`
          : "Turn on an authenticator app to use the staff workspace."}
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
      {recoveryCodes ? (
        <ul className="mt-4 grid gap-2 font-mono text-sm font-bold text-brand">
          {recoveryCodes.map((code) => (
            <li key={code} className="rounded-2xl bg-mint px-4 py-2">
              {code}
            </li>
          ))}
        </ul>
      ) : null}
      {!enabled ? (
        <div className="mt-6">
          {setup ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrDataUrl}
                alt="Authenticator QR code"
                className="h-44 w-44 rounded-2xl bg-white p-2"
              />
              <p className="mt-3 text-xs font-bold break-all text-brand">
                {setup.secret}
              </p>
              <form
                className="mt-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  setError("");
                  const form = new FormData(event.currentTarget);
                  try {
                    const result = await postJson<{ recoveryCodes: string[] }>(
                      "/api/v1/auth/two-factor/confirm",
                      { code: String(form.get("code") ?? "") },
                    );
                    setRecoveryCodes(result.recoveryCodes);
                    setSetup(null);
                    setMessage("Two-factor authentication is now required on every sign-in.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not enable");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <input
                  name="code"
                  required
                  minLength={6}
                  autoComplete="one-time-code"
                  className={fieldClass}
                  placeholder="6-digit code"
                />
                <Button type="submit" className="mt-4" disabled={pending}>
                  {pending ? "Checking…" : "Enable authenticator"}
                </Button>
              </form>
            </>
          ) : (
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  setSetup(await postJson<Setup>("/api/v1/auth/two-factor/setup", {}));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not start setup");
                } finally {
                  setPending(false);
                }
              }}
            >
              Set up authenticator
            </Button>
          )}
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              const result = await postJson<{ recoveryCodes: string[] }>(
                "/api/v1/account/two-factor/recovery-codes",
                { code: String(form.get("code") ?? "") },
              );
              setRecoveryCodes(result.recoveryCodes);
              setMessage("New recovery codes created. Previous unused codes no longer work.");
              event.currentTarget.reset();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not regenerate");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Current authenticator code
            </span>
            <input
              name="code"
              required
              minLength={6}
              autoComplete="one-time-code"
              className={fieldClass}
            />
          </label>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Create new recovery codes"}
          </Button>
        </form>
      )}
    </div>
  );
}
