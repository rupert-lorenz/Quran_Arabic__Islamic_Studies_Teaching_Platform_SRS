"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";
import { teacherAudiences, teacherGenders } from "@/lib/teacher-search";

export type TeacherProfileFields = {
  headline: string;
  bio: string;
  languages: string;
  country: string;
  gender?: string;
  audienceSlugs?: string[];
  subjectSlugs: string[];
};

export function TeacherProfileForm<T>({
  title = "Teaching profile",
  action,
  initial,
  catalog,
  countries,
  disabled = false,
  onSaved,
}: {
  title?: string;
  action: string;
  initial: TeacherProfileFields;
  catalog: { slug: string; name: string }[];
  countries: { iso2: string; name: string }[];
  disabled?: boolean;
  onSaved: (state: T) => void;
}) {
  const [subjects, setSubjects] = useState(initial.subjectSlugs);
  const [audiences, setAudiences] = useState(initial.audienceSlugs ?? []);
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
          onSaved(
            await patchJson<T>(action, {
              headline: String(form.get("headline") ?? ""),
              bio: String(form.get("bio") ?? ""),
              languages: String(form.get("languages") ?? ""),
              country: String(form.get("country") ?? ""),
              gender: String(form.get("gender") ?? ""),
              audienceSlugs: audiences,
              subjectSlugs: subjects,
            }),
          );
          setMessage("Profile saved.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Headline</span>
          <input
            name="headline"
            defaultValue={initial.headline}
            required
            minLength={4}
            disabled={disabled}
            className={fieldClass}
            placeholder="Qur'an and Tajweed teacher for children"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Bio</span>
          <textarea
            name="bio"
            defaultValue={initial.bio}
            required
            minLength={40}
            disabled={disabled}
            rows={5}
            className={`${fieldClass} py-3`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Languages</span>
          <input
            name="languages"
            defaultValue={initial.languages}
            required
            disabled={disabled}
            className={fieldClass}
            placeholder="English, Arabic"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Gender</span>
          <select
            name="gender"
            defaultValue={initial.gender ?? ""}
            disabled={disabled}
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
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-brand">
            Age groups
          </legend>
          <div className="flex flex-wrap gap-2">
            {teacherAudiences.map((item) => {
              const checked = audiences.includes(item.value);
              return (
                <label
                  key={item.value}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${
                    checked ? "bg-brand text-white" : "bg-mint text-brand"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    disabled={disabled}
                    checked={checked}
                    onChange={(event) => {
                      setAudiences((current) =>
                        event.target.checked
                          ? [...current, item.value]
                          : current.filter((value) => value !== item.value),
                      );
                    }}
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Country</span>
          <select
            name="country"
            defaultValue={initial.country}
            required
            disabled={disabled}
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
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-brand">Subjects</legend>
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
                    disabled={disabled}
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
      {disabled ? null : (
        <Button type="submit" className="mt-4" disabled={pending}>
          Save profile
        </Button>
      )}
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
