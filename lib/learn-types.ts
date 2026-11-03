/**
 * Learn-mode payload.
 *
 * Unlike `runner-types.ts` this *does* carry the answer key and explanation:
 * the whole point of learn mode is instant marking on the client. It is still
 * a local, single-user app — there is no exam integrity to protect here.
 */

export interface LearnQuestion {
  id: string;
  sectionId: string;
  sectionShort: string;
  stem: string;
  options: string[];
  /** Null for bonus questions (full marks to all). */
  correctIndex: number | null;
  explanation: string;
  sourceRef: string | null;
  isBonus: boolean;
}

export interface LearnPayload {
  attemptId: string;
  pageSize: number;
  questions: LearnQuestion[];
  /** Question id -> selected option index, from the server. */
  saved: Record<string, number | null>;
}
