import { z } from "zod";

export const answerEntrySchema = z.object({
  questionId: z.string().min(1),
  selectedIndex: z.number().int().min(0).max(3).nullable(),
  markedForReview: z.boolean().optional(),
  timeSpentMs: z.number().int().min(0).max(86_400_000).optional(),
});

export const saveAnswersSchema = z.object({
  answers: z.array(answerEntrySchema).max(200),
});

export type SaveAnswersBody = z.infer<typeof saveAnswersSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
  next: z
    .string()
    .trim()
    .max(512)
    .optional()
    .refine((value) => !value || (value.startsWith("/") && !value.startsWith("//")), {
      message: "next must be an internal path",
    }),
});

export type LoginBody = z.infer<typeof loginSchema>;
