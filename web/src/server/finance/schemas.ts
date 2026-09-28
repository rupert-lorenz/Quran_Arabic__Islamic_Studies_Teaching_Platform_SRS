import { z } from "zod";

export const requestTeacherPayoutSchema = z.object({
  amount: z.string().trim().min(1).max(20),
  currencyCode: z.string().trim().length(3),
  notes: z.string().trim().max(500).optional(),
});

export type RequestTeacherPayoutInput = z.infer<typeof requestTeacherPayoutSchema>;
