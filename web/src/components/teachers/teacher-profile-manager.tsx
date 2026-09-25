"use client";

import Link from "next/link";
import { useState } from "react";
import { patchJson } from "@/lib/api";
import { TeacherPhotoForm } from "@/components/teachers/teacher-photo-form";
import { TeacherProfileForm } from "@/components/teachers/teacher-profile-form";
import { TeacherRateLivePreview } from "@/components/teachers/teacher-rate-live-preview";

export type ManagedTeacherProfile = {
  userId: string;
  displayName: string;
  email: string;
  publicPath: string;
  photoUrl?: string | null;
  profile: {
    headline: string;
    bio: string;
    languages: string;
    country: string;
    gender?: string;
    audienceSlugs?: string[];
    subjectSlugs: string[];
  };
  rate: {
    amount: string;
    currencyCode: string;
    formatted: string;
    studentPays: string;
    teacherEarns: string;
    commissionAmount: string;
    commissionPercent: number;
  } | null;
  rateLimits: {
    minFormatted: string;
    maxFormatted: string;
    commissionPercent: number;
    lessonDurationMinutes: number;
    sources?: { label: string; appliesMin: boolean; appliesMax: boolean }[];
    conflict?: boolean;
  };
  catalog: { slug: string; name: string }[];
  countries: { iso2: string; name: string }[];
  currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[];
};

export function TeacherProfileManager({
  initial,
}: {
  initial: ManagedTeacherProfile;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TeacherPhotoForm
        name={state.displayName}
        photoUrl={state.photoUrl}
        onSaved={(photoUrl) => setState((current) => ({ ...current, photoUrl }))}
      />
      <TeacherProfileForm<ManagedTeacherProfile>
        key={`${state.profile.headline}-${state.profile.country}-${state.profile.subjectSlugs.join(",")}`}
        title="Marketplace profile"
        action="/api/v1/teacher/profile"
        initial={state.profile}
        catalog={state.catalog}
        countries={state.countries}
        onSaved={setState}
      />
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Lesson rate</h2>
        <p className="mt-2 text-sm text-muted">
          Families see this hourly price. Allowed range{" "}
          {state.rateLimits.minFormatted}–{state.rateLimits.maxFormatted}
          {state.rateLimits.sources?.length
            ? ` (${state.rateLimits.sources.map((item) => item.label).join(", ")})`
            : ""}
          .
        </p>
        {state.rateLimits.conflict ? (
          <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
            Staff pricing controls currently conflict. Ask staff to widen a
            range before you can save a rate.
          </p>
        ) : null}
        <TeacherRateLivePreview
          key={state.rate?.formatted ?? "no-rate"}
          initialAmount={state.rate?.amount ?? ""}
          initialCurrencyCode={state.rate?.currencyCode ?? state.currencies[0]?.code ?? "GBP"}
          currencies={state.currencies}
          commissionPercent={state.rateLimits.commissionPercent}
          durationMinutes={state.rateLimits.lessonDurationMinutes}
          pending={pending}
          onSubmit={async (input) => {
            setPending(true);
            setError("");
            setMessage("");
            try {
              setState(
                await patchJson<ManagedTeacherProfile>(
                  "/api/v1/teacher/profile/rate",
                  input,
                ),
              );
              setMessage("Lesson rate saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save rate");
            } finally {
              setPending(false);
            }
          }}
        />
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
        <p className="mt-6 text-sm font-semibold text-brand">
          <Link href={state.publicPath} className="underline">
            View your public profile
          </Link>
          {" · "}
          <Link href="/teach/status" className="underline">
            Verification status
          </Link>
          {" · "}
          <Link href="/teach/video" className="underline">
            Introduction video
          </Link>
        </p>
      </section>
    </div>
  );
}
