import { writeAuditLog } from "@/server/api/audit";
import { getConfig } from "@/server/config";

export async function sendAccountEmail(input: {
  to: string;
  subject: string;
  text: string;
  templateKey?: string;
}) {
  const config = getConfig();
  await writeAuditLog({
    actor: null,
    action: "email.composed",
    entityType: "email",
    metadata: {
      templateKey: input.templateKey ?? "custom",
      delivered: false,
    },
  });

  if (!process.env.EMAIL_API_KEY) {
    if (config.isDevelopment) {
      console.info("account_email_dev", {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    }
    return { delivered: false };
  }

  return { delivered: false };
}
