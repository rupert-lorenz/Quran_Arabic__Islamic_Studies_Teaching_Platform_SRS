import { getConfig } from "@/server/config";

export async function sendAccountEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  const config = getConfig();

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
