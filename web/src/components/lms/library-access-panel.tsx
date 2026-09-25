"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import {
  LIBRARY_GRANT_SOURCES,
  LIBRARY_ROLE_REFS,
  LIBRARY_RULE_TYPES,
  type LibraryGrantSource,
  type LibraryRuleType,
} from "@/lib/library-materials";
import type { UiMessageKey } from "@/lib/i18n";
import type {
  LibraryAccessCatalog,
  LibraryAccessRuleView,
  LibraryGrantView,
} from "@/server/lms/entitlements";

const ruleKeys = {
  role: "library.access.rule.role",
  live_course: "library.access.rule.live_course",
  group_lesson: "library.access.rule.group_lesson",
  subscription: "library.access.rule.subscription",
  licence: "library.access.rule.licence",
  purchase: "library.access.rule.purchase",
} as const satisfies Record<LibraryRuleType, UiMessageKey>;

const sourceKeys = {
  staff: "library.access.source.staff",
  purchase: "library.access.source.purchase",
  subscription: "library.access.source.subscription",
  licence: "library.access.source.licence",
} as const satisfies Record<LibraryGrantSource, UiMessageKey>;

const roleKeys = {
  student: "library.access.role.student",
  parent: "library.access.role.parent",
  teacher: "library.access.role.teacher",
  staff: "library.access.role.staff",
} as const;

export function LibraryAccessPanel({
  materialId,
  catalog,
  rules,
  grants,
  onChange,
}: {
  materialId: string;
  catalog: LibraryAccessCatalog;
  rules: LibraryAccessRuleView[];
  grants: LibraryGrantView[];
  onChange: (next: {
    rules: LibraryAccessRuleView[];
    grants: LibraryGrantView[];
    catalog: LibraryAccessCatalog;
  }) => void;
}) {
  const t = useT();
  const [ruleType, setRuleType] = useState<LibraryRuleType>("live_course");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const data = await postJson<{
        rules: LibraryAccessRuleView[];
        grants: LibraryGrantView[];
        catalog: LibraryAccessCatalog;
      }>(`/api/v1/library/${materialId}/entitlements`, body);
      onChange(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  function refsFor(type: LibraryRuleType) {
    if (type === "live_course") return catalog.liveCourses.map((item) => ({ value: item.id, label: item.title }));
    if (type === "group_lesson") return catalog.groupLessons.map((item) => ({ value: item.id, label: item.title }));
    if (type === "subscription") return catalog.plans.map((item) => ({ value: item.key, label: item.name }));
    if (type === "licence") return catalog.pools.map((item) => ({ value: item.key, label: item.name }));
    if (type === "role") {
      return LIBRARY_ROLE_REFS.map((value) => ({
        value,
        label: t(roleKeys[value]),
      }));
    }
    return [];
  }

  async function onAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({
      action: "add_rule",
      ruleType: String(form.get("ruleType")),
      ruleRef: String(form.get("ruleRef") ?? ""),
    });
  }

  async function onGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({
      action: "grant",
      email: String(form.get("email") ?? ""),
      source: String(form.get("source") ?? "staff"),
      expiresAt: String(form.get("expiresAt") ?? ""),
    });
    event.currentTarget.reset();
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <p className="font-heading text-sm font-bold tracking-tight text-brand">
        {t("library.access.rules")}
      </p>
      <form className="mt-3 grid gap-3 md:grid-cols-3" onSubmit={onAddRule}>
        <select
          name="ruleType"
          className={fieldClass}
          value={ruleType}
          onChange={(event) => setRuleType(event.target.value as LibraryRuleType)}
        >
          {LIBRARY_RULE_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(ruleKeys[value])}
            </option>
          ))}
        </select>
        {ruleType === "purchase" ? (
          <input type="hidden" name="ruleRef" value="purchase" />
        ) : (
          <select name="ruleRef" required className={fieldClass} defaultValue="">
            <option value="">{t("library.access.add_rule")}</option>
            {refsFor(ruleType).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" disabled={pending}>
          {t("library.access.add_rule")}
        </Button>
      </form>
      {rules.length ? (
        <ul className="mt-3 grid gap-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-brand">
              <span>
                {t(ruleKeys[rule.ruleType])} · {rule.label}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "remove_rule", ruleId: rule.id })}
              >
                {t("library.access.remove_rule")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-5 font-heading text-sm font-bold tracking-tight text-brand">
        {t("library.access.grants")}
      </p>
      <form className="mt-3 grid gap-3 md:grid-cols-4" onSubmit={onGrant}>
        <input
          name="email"
          type="email"
          required
          placeholder={t("library.access.student_email")}
          className={fieldClass}
        />
        <select name="source" className={fieldClass} defaultValue="staff">
          {LIBRARY_GRANT_SOURCES.map((value) => (
            <option key={value} value={value}>
              {t(sourceKeys[value])}
            </option>
          ))}
        </select>
        <input name="expiresAt" type="date" className={fieldClass} />
        <Button type="submit" disabled={pending}>
          {t("library.access.grant_student")}
        </Button>
      </form>
      {grants.length ? (
        <ul className="mt-3 grid gap-2">
          {grants.map((grant) => (
            <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-brand">
              <span>
                {grant.studentName}
                {` · ${t(sourceKeys[grant.source])}`}
                {grant.expiresAt
                  ? ` · ${t("library.access.grant_expires")} ${grant.expiresAt.slice(0, 10)}`
                  : ""}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "revoke", grantId: grant.id })}
              >
                {t("library.access.grant_revoke")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-3 text-sm font-semibold text-brand">{error}</p> : null}
    </div>
  );
}
