"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";

export type AgreementRecordView = {
  id: string;
  version: string;
  title: string;
  clauses: string[];
  signatureName: string;
  acceptedAt: string | Date;
  ipAddress: string | null;
  userAgent?: string | null;
  contentHash: string | null;
  valid: boolean;
  current: boolean;
};

export function TeacherAgreementRecord({
  record,
  staff = false,
  highlightOutdated = staff,
}: {
  record: AgreementRecordView;
  staff?: boolean;
  highlightOutdated?: boolean;
}) {
  const acceptedAt =
    record.acceptedAt instanceof Date
      ? record.acceptedAt
      : new Date(record.acceptedAt);

  return (
    <article className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase text-brand-soft">
        Digital signature record
      </p>
      <h3 className="mt-1 text-lg font-extrabold text-brand">{record.title}</h3>
      <p className="mt-1 text-sm text-muted">
        Version {record.version}
        {record.current ? " · Current terms" : " · Superseded"}
        {record.valid ? " · Hash verified" : " · Hash missing or changed"}
      </p>
      <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-brand">
        {record.clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ul>
      <p className="mt-5 font-extrabold text-brand" style={{ fontFamily: "Georgia, serif" }}>
        {record.signatureName}
      </p>
      <p className="mt-1 text-sm text-muted">
        Signed {acceptedAt.toLocaleString("en-GB")}
        {staff && record.ipAddress ? ` · ${record.ipAddress}` : ""}
      </p>
      {staff && record.userAgent ? (
        <p className="mt-1 break-all text-xs text-muted">{record.userAgent}</p>
      ) : null}
      {record.contentHash ? (
        <p className="mt-2 break-all text-xs font-semibold text-brand-soft">
          SHA-256 {record.contentHash}
        </p>
      ) : null}
      {highlightOutdated && !record.current ? (
        <p className="mt-3 text-sm font-semibold text-brand">
          This teacher has not signed the current agreement version yet.
        </p>
      ) : null}
    </article>
  );
}

export function TeacherAgreementSignForm<T>({
  title,
  version,
  clauses,
  defaultName,
  onSigned,
}: {
  title: string;
  version: string;
  clauses: string[];
  defaultName: string;
  onSigned: (state: T) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          onSigned(
            await postJson<T>("/api/v1/teacher/onboarding/agreement", {
              signatureName: String(form.get("signatureName") ?? ""),
              accepted: true,
            }),
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Version {version}. Your typed name, the time, your IP address, and a
        SHA-256 hash of these clauses are stored and cannot be edited later.
      </p>
      <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-brand">
        {clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ul>
      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-brand">
        <input type="checkbox" name="accepted" required className="mt-1 size-4" />
        I have read these terms and I sign them electronically.
      </label>
      <input
        name="signatureName"
        required
        minLength={2}
        defaultValue={defaultName}
        className={`${fieldClass} mt-4`}
        placeholder="Type your full legal name"
      />
      <Button type="submit" className="mt-4" disabled={pending}>
        Sign and store record
      </Button>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </form>
  );
}
