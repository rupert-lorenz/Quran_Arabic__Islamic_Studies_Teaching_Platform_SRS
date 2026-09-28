"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { CurrencySwitcher } from "@/components/money/currency-switcher";
import { TimezoneSwitcher } from "@/components/i18n/timezone-switcher";
import { useT } from "@/components/i18n/i18n-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import type { PublicCurrency } from "@/lib/currency";
import type { PublicLocale } from "@/lib/i18n";
import { isStaffRole } from "@/lib/rbac";
import {
  applicationStatusLabel,
  teacherStatusMessage,
} from "@/lib/teacher-status";
import Link from "next/link";

export function AccountSettings({
  displayName,
  email,
  roleKey,
  status,
  emailVerified,
  permissions = [],
  twoFactorRequired = false,
  twoFactorEnabled = false,
  verificationStatus,
  videoAwaitingReview = false,
  locales = [],
  locale = "en",
  languageLabel = "Language",
  currencies = [],
  currency = "GBP",
  currencyLabel = "Currency",
  timeZone = "",
  timezones = [],
  timezoneLabel = "Time zone",
}: {
  displayName: string;
  email: string;
  roleKey: string;
  status: string;
  emailVerified: boolean;
  permissions?: string[];
  twoFactorRequired?: boolean;
  twoFactorEnabled?: boolean;
  verificationStatus?: string | null;
  videoAwaitingReview?: boolean;
  locales?: PublicLocale[];
  locale?: string;
  languageLabel?: string;
  currencies?: PublicCurrency[];
  currency?: string;
  currencyLabel?: string;
  timeZone?: string;
  timezones?: string[];
  timezoneLabel?: string;
}) {
  const t = useT();
  const [name, setName] = useState(displayName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">{t("account.profile")}</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("common.email")}</dt>
            <dd className="font-bold text-brand">{email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("account.role")}</dt>
            <dd className="font-bold text-brand">{roleKey.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("account.status")}</dt>
            <dd className="font-bold text-brand">{status}</dd>
          </div>
          {verificationStatus ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Verification</dt>
              <dd className="font-bold text-brand">
                {applicationStatusLabel(verificationStatus)}
              </dd>
            </div>
          ) : null}
        </dl>
        {locales.length > 1 || currencies.length > 1 || timezones.length > 1 ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {locales.length > 1 ? (
              <LanguageSwitcher
                locales={locales}
                current={locale}
                label={languageLabel}
              />
            ) : null}
            {currencies.length > 1 ? (
              <CurrencySwitcher
                currencies={currencies}
                current={currency}
                label={currencyLabel}
              />
            ) : null}
            {timezones.length > 1 && timeZone ? (
              <TimezoneSwitcher
                timezones={timezones}
                current={timeZone}
                label={timezoneLabel}
                persist={roleKey !== "teacher"}
              />
            ) : null}
          </div>
        ) : null}
        {isStaffRole(roleKey) ? (
          <p className="mt-4">
            <Link href="/staff" className="font-bold text-brand underline">
              Open staff dashboard
            </Link>
          </p>
        ) : null}
        {twoFactorRequired ? (
          <p className="mt-4">
            <Link href="/account/security" className="font-bold text-brand underline">
              {twoFactorEnabled
                ? "Manage two-factor authentication"
                : "Set up two-factor authentication"}
            </Link>
          </p>
        ) : null}
        {permissions.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-bold text-brand">Permissions</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {permissions.map((key) => (
                <li
                  key={key}
                  className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-brand"
                >
                  {key}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!emailVerified ? (
          <p className="mt-4 rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
            Verify your email before using the marketplace.
          </p>
        ) : null}
        {roleKey === "parent" ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            This family account books and pays. Add each child from the family
            home — they do not get a separate login.{" "}
            <Link href="/family" className="underline">
              Family dashboard
            </Link>
            {" · "}
            <Link href="/family/children/new" className="underline">
              Add a child
            </Link>
            {" · "}
            <Link href="/family/profile" className="underline">
              Family profile
            </Link>
            {" · "}
            <Link href="/family/library" className="underline">
              Teaching library
            </Link>
            {" · "}
            <Link href="/family/homework" className="underline">
              Homework
            </Link>
            {" · "}
            <Link href="/family/games" className="underline">
              Interactive games
            </Link>
            {" · "}
            <Link href="/family/quizzes" className="underline">
              Quizzes
            </Link>
            {" · "}
            <Link href="/family/exams" className="underline">
              Exams
            </Link>
            {" · "}
            <Link href="/family/reports" className="underline">
              Student reports
            </Link>
            {" · "}
            <Link href="/family/certificates" className="underline">
              Certificates
            </Link>
            {" · "}
            <Link href="/family/rewards" className="underline">
              Rewards
            </Link>
            {" · "}
            <Link href="/family/attendance" className="underline">
              Attendance
            </Link>
            {" · "}
            <Link href="/family/activity" className="underline">
              Login and lesson times
            </Link>
            {" · "}
            <Link href="/family/progress" className="underline">
              Islamic education progress
            </Link>
            {" · "}
            <Link href="/family/quran" className="underline">
              Qur'an and Hifdh
            </Link>
            {" · "}
            <Link href="/family/arabic" className="underline">
              Arabic language
            </Link>
            {" · "}
            <Link href="/family/islamic-studies" className="underline">
              Islamic Studies
            </Link>
            {" · "}
            <Link href="/family/ai" className="underline">
              AI Systems
            </Link>
            {" · "}
            <Link href="/family/wallet" className="underline">
              Wallet
            </Link>
          </p>
        ) : null}
        {roleKey === "student" ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            Keep your learner profile up to date so teachers know your level and
            subjects.{" "}
            <Link href="/learn" className="underline">
              Student dashboard
            </Link>
            {" · "}
            <Link href="/learn/profile" className="underline">
              Student profile
            </Link>
            {" · "}
            <Link href="/learn/goals" className="underline">
              Learning goals
            </Link>
            {" · "}
            <Link href="/learn/history" className="underline">
              Lesson history
            </Link>
            {" · "}
            <Link href="/learn/library" className="underline">
              Teaching library
            </Link>
            {" · "}
            <Link href="/learn/homework" className="underline">
              Homework
            </Link>
            {" · "}
            <Link href="/learn/games" className="underline">
              Interactive games
            </Link>
            {" · "}
            <Link href="/learn/quizzes" className="underline">
              Quizzes
            </Link>
            {" · "}
            <Link href="/learn/exams" className="underline">
              Exams
            </Link>
            {" · "}
            <Link href="/learn/reports" className="underline">
              Student report
            </Link>
            {" · "}
            <Link href="/learn/certificates" className="underline">
              Certificates
            </Link>
            {" · "}
            <Link href="/learn/rewards" className="underline">
              Rewards
            </Link>
            {" · "}
            <Link href="/learn/attendance" className="underline">
              Attendance
            </Link>
            {" · "}
            <Link href="/learn/activity" className="underline">
              Login and lesson times
            </Link>
            {" · "}
            <Link href="/learn/progress" className="underline">
              Islamic education progress
            </Link>
            {" · "}
            <Link href="/learn/quran" className="underline">
              Qur'an and Hifdh
            </Link>
            {" · "}
            <Link href="/learn/arabic" className="underline">
              Arabic language
            </Link>
            {" · "}
            <Link href="/learn/islamic-studies" className="underline">
              Islamic Studies
            </Link>
            {" · "}
            <Link href="/learn/ai" className="underline">
              AI Systems
            </Link>
          </p>
        ) : null}
        {roleKey === "teacher" ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            {teacherStatusMessage(verificationStatus, { videoAwaitingReview })}{" "}
            <Link href="/teach/home" className="underline">
              Teacher dashboard
            </Link>
            {" · "}
            <Link href="/teach/status" className="underline">
              Verification status
            </Link>
            {status === "active" ? (
              <>
                {" · "}
                <Link href="/teach/profile" className="underline">
                  Profile and lesson rate
                </Link>
                {" · "}
                <Link href="/teach/video" className="underline">
                  Introduction video
                </Link>
                {" · "}
                <Link href="/teach/agreement" className="underline">
                  Agreement
                </Link>
                {" · "}
                <Link href="/teach/library" className="underline">
                  Teaching library
                </Link>
                {" · "}
                <Link href="/teach/homework" className="underline">
                  Homework
                </Link>
                {" · "}
                <Link href="/teach/games" className="underline">
                  Interactive games
                </Link>
                {" · "}
                <Link href="/teach/quizzes" className="underline">
                  Quizzes
                </Link>
                {" · "}
                <Link href="/teach/exams" className="underline">
                  Exams
                </Link>
                {" · "}
                <Link href="/teach/marking" className="underline">
                  Marking
                </Link>
                {" · "}
                <Link href="/teach/reports" className="underline">
                  Student reports
                </Link>
                {" · "}
                <Link href="/teach/certificates" className="underline">
                  Certificates
                </Link>
                {" · "}
                <Link href="/teach/rewards" className="underline">
                  Rewards
                </Link>
                {" · "}
                <Link href="/teach/attendance" className="underline">
                  Attendance
                </Link>
                {" · "}
                <Link href="/teach/activity" className="underline">
                  Login and lesson times
                </Link>
                {" · "}
                <Link href="/teach/progress" className="underline">
                  Islamic education progress
                </Link>
                {" · "}
                <Link href="/teach/quran" className="underline">
                  Qur'an and Hifdh
                </Link>
                {" · "}
                <Link href="/teach/arabic" className="underline">
                  Arabic language
                </Link>
                {" · "}
                <Link href="/teach/islamic-studies" className="underline">
                  Islamic Studies
                </Link>
                {" · "}
                <Link href="/teach/ai" className="underline">
                  AI Systems
                </Link>
                {" · "}
                <Link href="/teach/questions" className="underline">
                  Question bank
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        <form
          className="mt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            try {
              await patchJson("/api/v1/account", { displayName: name });
              setMessage("Display name saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Display name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
              minLength={2}
              required
            />
          </label>
          <Button type="submit" className="mt-4">
            Save name
          </Button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Password</h2>
        <p className="mt-2 text-sm text-muted">
          Changing your password signs out other devices.
        </p>
        <form
          className="mt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              await postJson("/api/v1/account/password", {
                currentPassword: String(form.get("currentPassword") ?? ""),
                newPassword: String(form.get("newPassword") ?? ""),
              });
              event.currentTarget.reset();
              setMessage("Password updated.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not update");
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Current password
            </span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              className={fieldClass}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-bold text-brand">
              New password
            </span>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={10}
              className={fieldClass}
            />
          </label>
          <Button type="submit" className="mt-4">
            Update password
          </Button>
        </form>
        <div className="mt-8">
          <LogoutButton />
        </div>
      </section>
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand lg:col-span-2">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand lg:col-span-2">
          {message}
        </p>
      ) : null}
    </div>
  );
}
