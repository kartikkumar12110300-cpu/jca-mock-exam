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
