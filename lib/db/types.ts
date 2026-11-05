export type Role = "user" | "admin";

export type Difficulty = "easy" | "medium" | "hard";
export type KeyStatus = "official" | "unofficial" | "disputed";
export type QuestionStatus = "published" | "draft" | "in_review" | "retired";
export type SourceType = "pyq" | "manual" | "topic";

export interface UserDoc {
  _id: string;
  username: string;
  passwordHash: string;
  role: Role;
  displayName: string;
  active: boolean;
  /**
   * Bumped whenever the password changes. A session token carries the value it
   * was minted with, so changing a password revokes every older session.
   */
  tokenVersion?: number;
  /** Seeded accounts keep this true until the owner sets a personal password. */
  mustChangePassword?: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface PaperDoc {
  _id: string;
  title: string;
  source: string;
  sourceType: SourceType;
  keyStatus: KeyStatus;
  status: QuestionStatus;
  createdAt: Date;
}

export interface QuestionDoc {
  _id: string;
  sectionId: string;
  topic: string;
  difficulty: Difficulty;
  stem: string;
  options: string[];
  correctIndex: number | null;
  isBonus: boolean;
  keyStatus: KeyStatus;
  explanation: string;
  sourceRef: string | null;
  sourceType: SourceType;
  paperId: string | null;
  status: QuestionStatus;
  tags: string[];
  contentHash: string;
  createdAt: Date;
}

export interface TestDoc {
  _id: string;
  userId: string;
  title: string;
  kind: "full" | "drill" | "learn";
  pattern: unknown;
  durationSec: number;
  questionIds: string[];
  isTemplate: boolean;
  createdAt: Date;
}

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
  total: number;
  max: number;
  percent: number;
  correct: number;
  wrong: number;
  skipped: number;
  bonus: number;
  sections: SectionScore[];
}

export interface AttemptDoc {
  _id: string;
  userId: string;
  testId: string;
  startedAt: Date;
  endsAt: Date;
  submittedAt: Date | null;
  status: "in_progress" | "submitted";
  score: Score | null;
  createdAt: Date;
}

export interface AnswerDoc {
  _id: string;
  attemptId: string;
  userId: string;
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  markedForReview: boolean;
  timeSpentMs: number;
  updatedAt: Date;
}

export interface LoginAttemptDoc {
  _id: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
  expiresAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}
