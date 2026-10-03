import { z } from "zod";
import { SECURE_MESSAGE_CHANNELS } from "@/lib/secure-messages";

export const sendSecureMessageSchema = z.object({
  channel: z.enum(SECURE_MESSAGE_CHANNELS),
  recipientUserId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export type SendSecureMessageInput = z.infer<typeof sendSecureMessageSchema>;
