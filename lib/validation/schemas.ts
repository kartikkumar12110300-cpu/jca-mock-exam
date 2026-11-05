import { z } from "zod";
import {
  DRILL_COUNTS,
  LEARN_MAX_QUESTIONS,
  SECTION_IDS,
} from "@/lib/exam/pattern";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username is too short")
    .max(32, "Username is too long")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid username"),
  password: z.string().min(1, "Password is required").max(128),
});

export const createAttemptSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("full") }),
  z.object({
    kind: z.literal("drill"),
    sectionId: z.enum([...SECTION_IDS] as [string, ...string[]]).optional(),
    count: z
      .number()
      .int()
      .refine((value) => (DRILL_COUNTS as readonly number[]).includes(value)),
    order: z.enum(["weak", "unseen", "random"]),
  }),
  z.object({
    kind: z.literal("learn"),
    sectionId: z.enum([...SECTION_IDS] as [string, ...string[]]).optional(),
    count: z.number().int().min(1).max(LEARN_MAX_QUESTIONS).optional(),
  }),
]);

export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedIndex: z.number().int().min(0).max(3).nullable(),
  markedForReview: z.boolean().optional(),
  timeSpentMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6, "Use at least 6 characters").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
