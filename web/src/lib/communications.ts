export const COMMUNICATION_MODULE_IDS = [
  "messages",
  "contact_guard",
  "email",
  "in_platform",
  "push",
  "sms",
  "whatsapp",
  "reminders",
  "templates",
] as const;

export type CommunicationModuleId = (typeof COMMUNICATION_MODULE_IDS)[number];

export type CommunicationModule = {
  id: CommunicationModuleId;
  live: boolean;
};

export const REMINDER_LEAD_HOURS = [1, 3, 12, 24, 48] as const;

export type ReminderLeadHour = (typeof REMINDER_LEAD_HOURS)[number];

export const COMMUNICATION_MODULES: CommunicationModule[] = [
  { id: "messages", live: true },
  { id: "contact_guard", live: true },
  { id: "email", live: true },
  { id: "in_platform", live: true },
  { id: "push", live: false },
  { id: "sms", live: false },
  { id: "whatsapp", live: false },
  { id: "reminders", live: true },
  { id: "templates", live: true },
];
