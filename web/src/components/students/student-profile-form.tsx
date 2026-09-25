"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import { studentLevels } from "@/lib/student-profile";
import { teacherGenders } from "@/lib/teacher-search";

export type StudentProfileFields = {
  displayName: string;
  dateOfBirth: string;
  currentLevel: string;
  country: string;
  timezone?: string;
  languages: string;
  gender: string;
  about: string;
  subjectSlugs: string[];
};

export function StudentProfileForm<T>({
  title = "Student profile",
  action = "/api/v1/student/profile",
  initial,
  catalog,
  countries,
  timezones = [],
  onSaved,
}: {
  title?: string;
  action?: string;
  initial: StudentProfileFields;
  catalog: { slug: string; name: string }[];
  countries: { iso2: string; name: string }[];
  timezones?: string[];
  onSaved?: (state: T) => void;
}) {
  const [subjects, setSubjects] = useState(initial.subjectSlugs);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        setMessage("");
        try {
          const next = await patchJson<T>(action, {
            displayName: String(form.get("displayName") ?? ""),
            dateOfBirth: String(form.get("dateOfBirth") ?? ""),
            currentLevel: String(form.get("currentLevel") ?? ""),
            country: String(form.get("country") ?? ""),
            timezone: String(form.get("timezone") ?? ""),
            languages: String(form.get("languages") ?? ""),
            gender: String(form.get("gender") ?? ""),
            about: String(form.get("about") ?? ""),
            subjectSlugs: subjects,
          });
          const zone = String(form.get("timezone") ?? "");
          if (zone) {
            await postJson("/api/v1/timezone", { timeZone: zone, persist: true });
          }
          onSaved?.(next);
          setMessage("Profile saved.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Families and teachers use this to match you with the right lessons.
        Completing it does not book a class.
      </p>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Display name
          </span>
          <input
            name="displayName"
            defaultValue={initial.displayName}
            required
            minLength={2}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Date of birth
          </span>
          <input
            type="date"
            name="dateOfBirth"
            defaultValue={initial.dateOfBirth}
            required
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Current level
          </span>
          <select
            name="currentLevel"
            defaultValue={initial.currentLevel}
            required
            className={fieldClass}
          >
            <option value="">Select level</option>
            {studentLevels.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Country</span>
          <select
            name="country"
            defaultValue={initial.country}
            required
            className={fieldClass}
          >
            <option value="">Select country</option>
            {countries.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        {timezones.length ? (
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Time zone</span>
            <select
              name="timezone"
              defaultValue={initial.timezone}
              className={fieldClass}
            >
              <option value="">Use this device</option>
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              Lesson times convert automatically to this zone.
            </span>
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Languages
          </span>
          <input
            name="languages"
            defaultValue={initial.languages}
            className={fieldClass}
            placeholder="English, Arabic"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Gender</span>
          <select
            name="gender"
            defaultValue={initial.gender}
            className={fieldClass}
          >
            <option value="">Not listed</option>
            {teacherGenders.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">About</span>
          <textarea
            name="about"
            defaultValue={initial.about}
            maxLength={1000}
            rows={4}
            className={`${fieldClass} py-3`}
            placeholder="What you want to learn, and anything a teacher should know."
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-brand">
            Subjects to learn
          </legend>
          <div className="flex flex-wrap gap-2">
            {catalog.map((subject) => {
              const checked = subjects.includes(subject.slug);
              return (
                <label
                  key={subject.slug}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${
                    checked ? "bg-brand text-white" : "bg-mint text-brand"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={(event) => {
                      setSubjects((current) =>
                        event.target.checked
                          ? [...current, subject.slug]
                          : current.filter((item) => item !== subject.slug),
                      );
                    }}
                  />
                  {subject.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
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
    </form>
  );
}
