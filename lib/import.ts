import { createHash } from "node:crypto";
import { z } from "zod";
import type { DB } from "./db";
import { questions, type NewQuestion } from "./db/schema";
import { SECTIONS } from "./pattern";

/**
 * JSON import pipeline.
 *
 * One file = one paper (or one topic batch). The CLI is `npm run import -- <file>`.
 * Everything is validated before a single row is written, and questions are
 * deduplicated by a hash of the normalised stem + options, so importing the same
 * file twice is a no-op.
 */

const answerSchema = z.union([
  z.number().int().min(1).max(4),
  z.enum(["A", "B", "C", "D", "a", "b", "c", "d"]),
]);

export const importedQuestionSchema = z.object({
  section: z.string().min(1),
  topic: z.string().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  stem: z.string().min(8),
  options: z.array(z.string().min(1)).length(4),
  /** 1–4 or "A"–"D". Omit when bonus is true. */
  answer: answerSchema.optional(),
  bonus: z.boolean().default(false),
  explanation: z.string().default(""),
  sourceRef: z.string().optional(),
  tags: z.array(z.string()).default([]),
  keyStatus: z.enum(["official", "unofficial", "disputed"]).optional(),
  sourceType: z.enum(["pyq", "ai", "manual"]).optional(),
  status: z.enum(["draft", "in_review", "published", "retired"]).optional(),
});

export const importFileSchema = z.object({
  paper: z
    .object({
      title: z.string().min(1),
      source: z.string().optional(),
      sourceType: z.enum(["pyq", "ai", "manual"]).default("manual"),
      keyStatus: z.enum(["official", "unofficial", "disputed"]).default("unofficial"),
      status: z.enum(["draft", "in_review", "published", "retired"]).default("published"),
    })
    .optional(),
  questions: z.array(importedQuestionSchema).min(1),
});

export type ImportFile = z.infer<typeof importFileSchema>;

export interface ImportReport {
  file: string;
  total: number;
  inserted: number;
  skippedDuplicates: number;
  invalid: Array<{ index: number; message: string }>;
  dryRun: boolean;
}

function normalise(stem: string, options: string[]): string {
  return `${stem}::${options.join("|")}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function contentHash(stem: string, options: string[]): string {
  return createHash("sha1").update(normalise(stem, options)).digest("hex");
}

function toIndex(answer: z.infer<typeof answerSchema>): number {
  if (typeof answer === "number") return answer - 1;
  return answer.toUpperCase().charCodeAt(0) - 65;
}

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id));

export function importPayload(
  payload: ImportFile,
  options: { file?: string; dryRun?: boolean },
  database: DB,
): ImportReport {
  const report: ImportReport = {
    file: options.file ?? "<inline>",
    total: payload.questions.length,
    inserted: 0,
    skippedDuplicates: 0,
    invalid: [],
    dryRun: options.dryRun ?? false,
  };

  const existing = new Set(
    database.select({ hash: questions.contentHash }).from(questions).all().map((r) => r.hash),
  );

  const rows: NewQuestion[] = [];

  payload.questions.forEach((q, index) => {
    if (!SECTION_IDS.has(q.section)) {
      report.invalid.push({
        index,
        message: `unknown section "${q.section}" (expected one of ${[...SECTION_IDS].join(", ")})`,
      });
      return;
    }

    if (!q.bonus && q.answer === undefined) {
      report.invalid.push({ index, message: "missing answer (required unless bonus is true)" });
      return;
    }

    const hash = contentHash(q.stem, q.options);
    if (existing.has(hash)) {
      report.skippedDuplicates += 1;
      return;
    }
    existing.add(hash);

    rows.push({
      sectionId: q.section as (typeof SECTIONS)[number]["id"],
      topic: q.topic,
      difficulty: q.difficulty,
      stem: q.stem,
      options: q.options,
      correctIndex: q.bonus ? null : toIndex(q.answer!),
      isBonus: q.bonus,
      keyStatus: q.keyStatus ?? payload.paper?.keyStatus ?? "unofficial",
      explanation: q.explanation,
      sourceRef: q.sourceRef ?? payload.paper?.source ?? null,
      sourceType: q.sourceType ?? payload.paper?.sourceType ?? "manual",
      status: q.status ?? payload.paper?.status ?? "published",
      tags: q.tags,
      contentHash: hash,
    });
  });

  report.inserted = rows.length;

  if (!report.dryRun && rows.length > 0) {
    database.insert(questions).values(rows).run();
  }

  return report;
}
