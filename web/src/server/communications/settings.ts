import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  REMINDER_LEAD_HOURS,
  type ReminderLeadHour,
} from "@/lib/communications";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";

export const REMINDER_SETTING_KEY = "communications.lesson_reminders";
export const TEMPLATE_SETTING_KEY = "communications.email_templates";

export type ReminderSettings = {
  enabled: boolean;
  leadHours: ReminderLeadHour[];
};

export const EMAIL_TEMPLATE_KEYS = [
  "verify_email",
  "password_reset",
  "booking_confirmed",
  "lesson_reminder",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type EmailTemplate = {
  key: EmailTemplateKey;
  subject: string;
  body: string;
};

const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  leadHours: [24, 1],
};

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, Omit<EmailTemplate, "key">> =
  {
    verify_email: {
      subject: "Confirm your account",
      body: "Hello {{name}}, use the confirmation link from your registration notice to open your account.",
    },
    password_reset: {
      subject: "Reset your password",
      body: "Hello {{name}}, use the reset link from your password notice to choose a new password.",
    },
    booking_confirmed: {
      subject: "Lesson confirmed",
      body: "Hello {{name}}, your lesson is confirmed for {{when}}. Open it from {{link}}.",
    },
    lesson_reminder: {
      subject: "Lesson reminder",
      body: "Hello {{name}}, your lesson is coming up at {{when}}. Open it from {{link}}.",
    },
  };

const leadHourSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(12),
  z.literal(24),
  z.literal(48),
]);

export const updateReminderSettingsSchema = z.object({
  enabled: z.boolean(),
  leadHours: z.array(leadHourSchema).min(1).max(2),
});

export const updateEmailTemplateSchema = z.object({
  key: z.enum(EMAIL_TEMPLATE_KEYS),
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
});

export type UpdateReminderSettingsInput = z.infer<typeof updateReminderSettingsSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

function isLeadHour(value: number): value is ReminderLeadHour {
  return (REMINDER_LEAD_HOURS as readonly number[]).includes(value);
}

export function parseReminderSettings(value: unknown): ReminderSettings {
  if (!value || typeof value !== "object") return DEFAULT_REMINDERS;
  const record = value as { enabled?: unknown; leadHours?: unknown };
  const leadHours = Array.isArray(record.leadHours)
    ? [
        ...new Set(
          record.leadHours.filter(
            (item): item is ReminderLeadHour =>
              typeof item === "number" && isLeadHour(item),
          ),
        ),
      ].slice(0, 2)
    : [];
  return {
    enabled: record.enabled !== false,
    leadHours: leadHours.length ? leadHours : DEFAULT_REMINDERS.leadHours,
  };
}

export function parseEmailTemplates(value: unknown): EmailTemplate[] {
  const stored =
    value && typeof value === "object"
      ? (value as Partial<Record<EmailTemplateKey, { subject?: unknown; body?: unknown }>>)
      : {};
  return EMAIL_TEMPLATE_KEYS.map((key) => {
    const row = stored[key];
    const fallback = DEFAULT_EMAIL_TEMPLATES[key];
    const subject =
      row && typeof row.subject === "string" && row.subject.trim()
        ? row.subject.trim().slice(0, 120)
        : fallback.subject;
    const body =
      row && typeof row.body === "string" && row.body.trim()
        ? row.body.trim().slice(0, 500)
        : fallback.body;
    return { key, subject, body };
  });
}

export function fillEmailTemplate(
  body: string,
  tokens: { name?: string; when?: string; link?: string },
) {
  return body.replace(/\{\{(name|when|link)\}\}/g, (_, key: string) => {
    if (key === "name") return tokens.name || "there";
    if (key === "when") return tokens.when || "";
    return tokens.link || "";
  });
}

async function readSetting(key: string) {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value;
}

export async function getReminderSettings() {
  return parseReminderSettings(await readSetting(REMINDER_SETTING_KEY));
}

export async function getEmailTemplates() {
  return parseEmailTemplates(await readSetting(TEMPLATE_SETTING_KEY));
}

function assertCanEdit(actor: ApiActor) {
  if (!hasAnyPermission(actor, "settings.write")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change communication settings");
  }
}

export async function updateReminderSettings(
  actor: ApiActor,
  input: UpdateReminderSettingsInput,
  ip: string,
) {
  assertCanEdit(actor);
  const next: ReminderSettings = {
    enabled: input.enabled,
    leadHours: [...new Set(input.leadHours)],
  };
  await db
    .insert(platformSettings)
    .values({ key: REMINDER_SETTING_KEY, value: next })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next },
    });
  await writeAuditLog({
    actor,
    action: "settings.reminders_updated",
    entityType: "platform_settings",
    entityId: REMINDER_SETTING_KEY,
    ipAddress: ip,
    metadata: { enabled: next.enabled, leadHours: next.leadHours },
  });
  return next;
}

export async function updateEmailTemplate(
  actor: ApiActor,
  input: UpdateEmailTemplateInput,
  ip: string,
) {
  assertCanEdit(actor);
  if (classroomContainsContactDetails(`${input.subject}\n${input.body}`)) {
    throw new ApiError(
      422,
      "CONTACT_BLOCKED",
      "Keep phone numbers and personal accounts out of the template",
    );
  }
  const current = await getEmailTemplates();
  const next = Object.fromEntries(
    current.map((item) => [
      item.key,
      item.key === input.key
        ? { subject: input.subject, body: input.body }
        : { subject: item.subject, body: item.body },
    ]),
  );
  await db
    .insert(platformSettings)
    .values({ key: TEMPLATE_SETTING_KEY, value: next })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next },
    });
  await writeAuditLog({
    actor,
    action: "settings.email_template_updated",
    entityType: "platform_settings",
    entityId: input.key,
    ipAddress: ip,
    metadata: { key: input.key },
  });
  return parseEmailTemplates(next);
}
