import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { PatternSnapshot } from "../pattern";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const now = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());

/**
 * Accounts are seeded at first boot and never created through the UI.
 * `password_hash` is a scrypt digest — see `lib/auth/password.ts`.
 */
export const users = sqliteTable(
  "users",
  {
    id: id(),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: now(),
  },
  (t) => [index("users_role_idx").on(t.role)],
);

/**
 * DB-backed sessions, so logout and deactivation revoke access immediately.
 * Only the sha256 of the cookie token is stored.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: now(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Login throttling that survives serverless cold starts.
 * Key is `username|ip`; the window resets on a successful login.
 */
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStart: integer("window_start", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    sectionId: text("section_id").notNull(),
    topic: text("topic").notNull().default(""),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
      .notNull()
      .default("medium"),
    stem: text("stem").notNull(),
    /** Exactly four option strings for the objective paper. */
    options: text("options", { mode: "json" }).$type<string[]>().notNull(),
    /** Null when isBonus is true. */
    correctIndex: integer("correct_index"),
    /** 2025 key awarded full marks to all for 3 questions — model it explicitly. */
    isBonus: integer("is_bonus", { mode: "boolean" }).notNull().default(false),
    /**
     * official  = answer verified against the official source text (statute/notification)
     * unofficial = derived by us, or from a third-party key
     * disputed   = contested / known bad key
     */
    keyStatus: text("key_status", { enum: ["official", "unofficial", "disputed"] })
      .notNull()
      .default("unofficial"),
    explanation: text("explanation").notNull().default(""),
    /** e.g. "Constitution Art. 145" or "JCA_2022_27Sep.pdf Q37" */
    sourceRef: text("source_ref"),
    sourceType: text("source_type", { enum: ["pyq", "ai", "manual"] })
      .notNull()
      .default("manual"),
    paperId: text("paper_id"),
    status: text("status", { enum: ["draft", "in_review", "published", "retired"] })
      .notNull()
      .default("published"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** sha1 of normalised stem+options, for dedupe on import/generation. */
    contentHash: text("content_hash").notNull().default(""),
    createdAt: now(),
  },
  (t) => [
    index("questions_section_idx").on(t.sectionId, t.status),
    index("questions_hash_idx").on(t.contentHash),
  ],
);

/** A playable paper. Stores its own pattern so legacy papers stay faithful. */
export const tests = sqliteTable("tests", {
  id: id(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["full", "sectional", "custom", "drill", "learn"] })
    .notNull()
    .default("full"),
  pattern: text("pattern", { mode: "json" }).$type<PatternSnapshot>().notNull(),
  durationSec: integer("duration_sec").notNull(),
  /** Ordered question ids, grouped by section order. */
  questionIds: text("question_ids", { mode: "json" }).$type<string[]>().notNull(),
  isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
  createdAt: now(),
});

export interface SectionScore {
  sectionId: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  bonus: number;
  net: number;
}

export interface Score {
  correct: number;
  wrong: number;
  skipped: number;
  bonus: number;
  attempted: number;
  raw: number;
  net: number;
  accuracy: number;
  perSection: SectionScore[];
}

export const attempts = sqliteTable(
  "attempts",
  {
    id: id(),
    /** Owner. Every read and write is scoped by this column. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testId: text("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    /** startedAt + duration. Timer is derived from this, never from tick counting. */
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    status: text("status", { enum: ["in_progress", "submitted", "expired", "abandoned"] })
      .notNull()
      .default("in_progress"),
    score: text("score", { mode: "json" }).$type<Score | null>(),
    createdAt: now(),
  },
  (t) => [
    index("attempts_test_idx").on(t.testId),
    index("attempts_user_started_idx").on(t.userId, t.startedAt),
  ],
);

export const answers = sqliteTable(
  "answers",
  {
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedIndex: integer("selected_index"),
    markedForReview: integer("marked_for_review", { mode: "boolean" })
      .notNull()
      .default(false),
    timeSpentMs: integer("time_spent_ms").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })],
);

export type Role = "user" | "admin";
export type User = typeof users.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Test = typeof tests.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Answer = typeof answers.$inferSelect;
