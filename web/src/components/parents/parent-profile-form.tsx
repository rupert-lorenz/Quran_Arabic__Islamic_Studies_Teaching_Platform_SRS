"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import { parentRelationships } from "@/lib/parent-profile";

export type ParentProfileFields = {
  displayName: string;
  dateOfBirth: string;
  relationship: string;
  country: string;
  timezone?: string;
  phone: string;
  about: string;
};

export function ParentProfileForm<T>({
  title = "Family profile",
  action = "/api/v1/parent/profile",
  initial,
  countries,
  timezones = [],
  onSaved,
}: {
  title?: string;
  action?: string;
  initial: ParentProfileFields;
  countries: { iso2: string; name: string }[];
  timezones?: string[];
  onSaved?: (state: T) => void;
}) {
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
            relationship: String(form.get("relationship") ?? ""),
            country: String(form.get("country") ?? ""),
            timezone: String(form.get("timezone") ?? ""),
            phone: String(form.get("phone") ?? ""),
            about: String(form.get("about") ?? ""),
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
        This is the adult account that books, pays, and stays in control.
        Teachers do not see your phone number.
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
            I am a
          </span>
          <select
            name="relationship"
            defaultValue={initial.relationship}
            required
            className={fieldClass}
          >
            <option value="">Select relationship</option>
            {parentRelationships.map((item) => (
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
            Phone (optional)
          </span>
          <input
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            className={fieldClass}
            placeholder="+44 7700 900123"
          />
          <span className="mt-1 block text-xs text-muted">
            For platform staff only. Not shared with teachers.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Notes</span>
          <textarea
            name="about"
            defaultValue={initial.about}
            maxLength={1000}
            rows={4}
            className={`${fieldClass} py-3`}
            placeholder="Anything staff should know about your family."
          />
        </label>
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
