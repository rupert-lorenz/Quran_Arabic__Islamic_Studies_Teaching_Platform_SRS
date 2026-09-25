"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteJson, fieldClass, patchJson, postJson } from "@/lib/api";
import { studentLevels } from "@/lib/student-profile";
import { teacherGenders } from "@/lib/teacher-search";
import type { StudentProfileFields } from "@/components/students/student-profile-form";

export function ChildProfileForm<T extends { userId?: string }>({
  title,
  action,
  method = "POST",
  initial,
  catalog,
  countries,
  isPrimary = false,
  canRemove = false,
}: {
  title: string;
  action: string;
  method?: "POST" | "PATCH";
  initial: StudentProfileFields;
  catalog: { slug: string; name: string }[];
  countries: { iso2: string; name: string }[];
  isPrimary?: boolean;
  canRemove?: boolean;
}) {
  const router = useRouter();
  const [subjects, setSubjects] = useState(initial.subjectSlugs);
  const [primary, setPrimary] = useState(isPrimary);
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
        const payload = {
          displayName: String(form.get("displayName") ?? ""),
          dateOfBirth: String(form.get("dateOfBirth") ?? ""),
          currentLevel: String(form.get("currentLevel") ?? "") || undefined,
          country: String(form.get("country") ?? "") || undefined,
          languages: String(form.get("languages") ?? ""),
          gender: String(form.get("gender") ?? ""),
          about: String(form.get("about") ?? ""),
          subjectSlugs: subjects,
          ...(method === "PATCH" ? { isPrimary: primary } : {}),
        };
        try {
          const next =
            method === "POST"
              ? await postJson<T>(action, payload)
              : await patchJson<T>(action, payload);
          setMessage(method === "POST" ? "Child added." : "Child profile saved.");
          if (method === "POST" && next.userId) {
            router.push(`/family/children/${next.userId}`);
            router.refresh();
            return;
          }
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <p className="mt-2 text-sm text-muted">
        Each child has a separate learning profile. They do not get their own
        login — you stay in control of booking and payments.
      </p>
      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Child&apos;s name
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
          <span className="mt-1 block text-xs text-muted">
            Family profiles are for children aged 3 to 17.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Current level
          </span>
          <select
            name="currentLevel"
            defaultValue={initial.currentLevel}
            className={fieldClass}
          >
            <option value="">Add this later</option>
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
            className={fieldClass}
          >
            <option value="">Use family country</option>
            {countries.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
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
            placeholder="What they want to learn, and anything a teacher should know."
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
        {method === "PATCH" ? (
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-brand">
            <input
              type="checkbox"
              checked={primary}
              onChange={(event) => setPrimary(event.target.checked)}
              className="size-5 accent-[var(--brand)]"
            />
            Primary child on this family account
          </label>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : method === "POST"
              ? "Add child"
              : "Save child"}
        </Button>
        {canRemove ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              if (
                !window.confirm(
                  "Remove this child from your family account? Their managed profile will be closed.",
                )
              ) {
                return;
              }
              setPending(true);
              setError("");
              try {
                await deleteJson(action);
                router.push("/family");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not remove");
                setPending(false);
              }
            }}
          >
            Remove child
          </Button>
        ) : null}
      </div>
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
