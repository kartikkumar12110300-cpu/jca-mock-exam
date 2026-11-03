/**
 * Seed question bank — 20 hand-written questions covering all 7 sections.
 *
 * Every answer here is verifiable against the study material:
 *   04_Notes/02_Constitution_Judiciary.md
 *   04_Notes/03_SC_Rules_2013_Key_Points.md
 *   04_Notes/04_Rules_1961_Key_Points.md
 * plus ordinary English / aptitude / GK / computer facts.
 *
 * Kept separate from `seed.ts` (the CLI) so the app can seed itself on first
 * boot without running a script.
 */
import { createHash } from "node:crypto";
import type { NewQuestion } from "./schema";
import type { SectionId } from "../pattern";

interface SeedInput {
  sectionId: SectionId;
  topic: string;
  difficulty?: "easy" | "medium" | "hard";
  stem: string;
  options: [string, string, string, string];
  /** Index of the correct option. Omit for bonus questions. */
  answer?: number;
  isBonus?: boolean;
  explanation: string;
  sourceRef?: string;
  keyStatus?: "official" | "unofficial" | "disputed";
}

function makeQuestion(input: SeedInput): NewQuestion {
  const normalised = `${input.stem}::${input.options.join("|")}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return {
    sectionId: input.sectionId,
    topic: input.topic,
    difficulty: input.difficulty ?? "medium",
    stem: input.stem,
    options: input.options,
    correctIndex: input.isBonus ? null : input.answer,
    isBonus: input.isBonus ?? false,
    keyStatus: input.keyStatus ?? "official",
    explanation: input.explanation,
    sourceRef: input.sourceRef ?? null,
    sourceType: "manual",
    status: "published",
    tags: [],
    contentHash: createHash("sha1").update(normalised).digest("hex"),
  };
}

const seed: SeedInput[] = [
  // ---------------------------------------------------------------- English
  {
    sectionId: "english",
    topic: "Vocabulary — synonym",
    difficulty: "easy",
    stem: "Choose the word most nearly opposite in meaning to **abrogate**.",
    options: ["Repeal", "Ratify", "Postpone", "Clarify"],
    answer: 1,
    explanation:
      "To abrogate is to repeal or abolish (a law or agreement). Its opposite is to ratify — to formally approve or confirm.",
    sourceRef: "English — vocabulary",
  },
  {
    sectionId: "english",
    topic: "Vocabulary — antonym",
    difficulty: "easy",
    stem: "Select the antonym of **frugal**.",
    options: ["Thrifty", "Extravagant", "Prudent", "Economical"],
    answer: 1,
    explanation:
      "Frugal means sparing or economical. Extravagant — spending much more than necessary — is its opposite. The other three are synonyms.",
    sourceRef: "English — vocabulary",
  },
  {
    sectionId: "english",
    topic: "One-word substitution",
    difficulty: "medium",
    stem: "One word for 'a person who speaks many languages':",
    options: ["Linguist", "Polyglot", "Bilingual", "Philologist"],
    answer: 1,
    explanation:
      "A polyglot speaks or writes several languages. A linguist studies language as a subject; a bilingual person knows two.",
    sourceRef: "English — one-word substitution",
  },

  // --------------------------------------------------------------- Aptitude
  {
    sectionId: "aptitude",
    topic: "Percentage",
    difficulty: "easy",
    stem: "If 20% of a number is 60, what is the number?",
    options: ["120", "240", "300", "360"],
    answer: 2,
    explanation: "Let the number be x. 0.20x = 60, so x = 60 / 0.20 = 300.",
    sourceRef: "Aptitude — percentage",
  },
  {
    sectionId: "aptitude",
    topic: "Number series",
    difficulty: "medium",
    stem: "Find the next term: 2, 6, 12, 20, 30, ?",
    options: ["38", "40", "42", "44"],
    answer: 2,
    explanation:
      "The terms follow n(n+1): 1·2, 2·3, 3·4, 4·5, 5·6 — so the next is 6·7 = 42. (Differences are 4, 6, 8, 10, 12.)",
    sourceRef: "Aptitude — series",
  },
  {
    sectionId: "aptitude",
    topic: "Speed, time and distance",
    difficulty: "easy",
    stem: "A train covers 120 km in 1 hour 30 minutes. Its average speed is:",
    options: ["70 km/h", "75 km/h", "80 km/h", "90 km/h"],
    answer: 2,
    explanation:
      "1 h 30 min = 1.5 h. Speed = distance / time = 120 / 1.5 = 80 km/h.",
    sourceRef: "Aptitude — speed, time and distance",
  },

  // --------------------------------------------------------------------- GK
  {
    sectionId: "gk",
    topic: "International organisations",
    difficulty: "easy",
    stem: "The headquarters of UNESCO is located in:",
    options: ["Geneva", "New York", "Paris", "Vienna"],
    answer: 2,
    explanation:
      "UNESCO is headquartered in Paris, France. Geneva hosts the WHO and ILO; New York hosts the UN Secretariat; Vienna hosts the IAEA.",
    sourceRef: "GK — international organisations",
  },
  {
    sectionId: "gk",
    topic: "World currencies",
    difficulty: "easy",
    stem: "The currency of Japan is the:",
    options: ["Won", "Yuan", "Yen", "Ringgit"],
    answer: 2,
    explanation:
      "Japan uses the yen. The won is Korean, the yuan Chinese, and the ringgit Malaysian.",
    sourceRef: "GK — currencies",
  },
  {
    sectionId: "gk",
    topic: "Indian polity — institutions",
    difficulty: "medium",
    stem: "The Supreme Court of India was inaugurated on:",
    options: ["26 January 1950", "28 January 1950", "26 November 1949", "1 April 1950"],
    answer: 1,
    explanation:
      "The Constitution came into force on 26 January 1950, but the Supreme Court itself was inaugurated two days later, on 28 January 1950.",
    sourceRef: "04_Notes/02_Constitution_Judiciary.md — high-yield facts",
  },

  // ----------------------------------------------------------- Constitution
  {
    sectionId: "constitution",
    topic: "Article 145 — rules of court",
    difficulty: "medium",
    stem: "Which Article of the Constitution empowers the Supreme Court to make rules regulating its practice and procedure?",
    options: ["Article 141", "Article 144", "Article 145", "Article 146"],
    answer: 2,
    explanation:
      "Article 145 is the enabling provision for the Supreme Court Rules, 2013. Article 146 covers officers and servants of the Court and is the source of the SCI Officers & Servants Rules, 1961.",
    sourceRef: "04_Notes/02_Constitution_Judiciary.md — Art. 145",
  },
  {
    sectionId: "constitution",
    topic: "Article 142 — complete justice",
    difficulty: "medium",
    stem: "'Such decree or make such order as is necessary for doing complete justice' appears in which Article?",
    options: ["Article 136", "Article 141", "Article 142", "Article 143"],
    answer: 2,
    explanation:
      "Article 142 gives the Supreme Court power to pass any order necessary for complete justice in a matter pending before it. It cannot be used to defeat substantive law.",
    sourceRef: "04_Notes/02_Constitution_Judiciary.md — Art. 142",
  },
  {
    sectionId: "constitution",
    topic: "Article 124B — retirement age",
    difficulty: "easy",
    stem: "A judge of the Supreme Court holds office until attaining the age of:",
    options: ["60 years", "62 years", "65 years", "68 years"],
    answer: 2,
    explanation:
      "Article 124B fixes 65 years for Supreme Court judges. High Court judges retire at 62.",
    sourceRef: "04_Notes/02_Constitution_Judiciary.md — Art. 124B",
  },

  // --------------------------------------------------------- SC Rules 2013
  {
    sectionId: "sc-rules-2013",
    topic: "Order I — definitions",
    difficulty: "medium",
    stem: "Under the Supreme Court Rules, 2013, the expression 'Court appealed from' includes:",
    options: [
      "Only a High Court",
      "A Tribunal or any other judicial body",
      "Only a subordinate civil court",
      "Only a criminal court",
    ],
    answer: 1,
    explanation:
      "Order I Rule 2 defines 'Court appealed from' to include a Tribunal or any other judicial body from which an appeal is preferred to the Court.",
    sourceRef: "04_Notes/03_SC_Rules_2013_Key_Points.md — Order I r.2",
  },
  {
    sectionId: "sc-rules-2013",
    topic: "Order IV — advocates-on-record",
    difficulty: "medium",
    stem: "For a person to be eligible for enrolment as an advocate-on-record, their name must have been on the roll of a State Bar Council for at least:",
    options: ["Two years", "Three years", "Four years", "Five years"],
    answer: 2,
    explanation:
      "Order IV Rule 5 requires (i) four years on a State Bar Council roll as on the date training commences, (ii) one year's training with an approved AoR, and (iii) passing the AoR examination.",
    sourceRef: "04_Notes/03_SC_Rules_2013_Key_Points.md — Order IV r.5",
  },
  {
    sectionId: "sc-rules-2013",
    topic: "Order III — officers of the Court",
    difficulty: "easy",
    stem: "Custody of the records of the Supreme Court is vested in the:",
    options: ["Registrar", "Secretary General", "Taxing Officer", "Chief Justice of India"],
    answer: 1,
    explanation:
      "Order III places the records of the Court, and the official seal, in the custody of the Secretary General.",
    sourceRef: "04_Notes/03_SC_Rules_2013_Key_Points.md — Order III",
  },

  // -------------------------------------------------------- Rules 1961
  {
    sectionId: "sci-rules-1961",
    topic: "Enabling provision",
    difficulty: "medium",
    stem: "The SCI Officers and Servants (Conditions of Service and Conduct) Rules, 1961 were framed under:",
    options: ["Article 145", "Article 146", "Article 147", "Article 309"],
    answer: 1,
    explanation:
      "Article 146 provides for officers and servants of the Supreme Court, with appointments made by the Chief Justice of India. Article 145 is the source of the Supreme Court Rules, 2013.",
    sourceRef: "04_Notes/04_Rules_1961_Key_Points.md",
  },
  {
    sectionId: "sci-rules-1961",
    topic: "Structure — Parts",
    difficulty: "easy",
    stem: "Which Part of the SCI Officers and Servants Rules, 1961 deals with Conduct?",
    options: ["Part II", "Part III", "Part IV", "Part V"],
    answer: 2,
    explanation:
      "Part I General (rr.1–2), Part II Strength/Appointment/Conditions (rr.3–9), Part III Control and Discipline (rr.10–23), Part IV Conduct (rr.24–46), Part V Miscellaneous (rr.47–49).",
    sourceRef: "04_Notes/04_Rules_1961_Key_Points.md — structure table",
  },
  {
    sectionId: "sci-rules-1961",
    topic: "Penalties",
    difficulty: "medium",
    stem: "Which rule of the SCI Officers and Servants Rules, 1961 lists the penalties that may be imposed on a Court servant?",
    options: ["Rule 10", "Rule 11", "Rule 12", "Rule 13"],
    answer: 1,
    explanation:
      "Rule 11 lists the penalties; Rule 12 specifies the disciplinary authorities; Rule 13 prescribes the procedure for major penalties and Rule 14 for minor penalties.",
    sourceRef: "04_Notes/04_Rules_1961_Key_Points.md — Part III",
  },

  // ------------------------------------------------------------- Computer
  {
    sectionId: "computer",
    topic: "Memory units",
    difficulty: "easy",
    stem: "1 kilobyte (KB) is equal to:",
    options: ["1000 bytes", "1024 bytes", "1024 bits", "1000 bits"],
    answer: 1,
    explanation:
      "In binary terms 1 KB = 2^10 = 1024 bytes. Storage manufacturers often use 1000, but the standard computer-science answer is 1024.",
    sourceRef: "Computer fundamentals — memory units",
  },
  {
    sectionId: "computer",
    topic: "Memory types",
    difficulty: "easy",
    stem: "Which of the following is a volatile memory?",
    options: ["ROM", "RAM", "Hard disk", "Flash drive"],
    answer: 1,
    explanation:
      "RAM loses its contents when power is removed, so it is volatile. ROM, hard disks and flash drives retain data without power.",
    sourceRef: "Computer fundamentals — memory",
  },
];

/** All seed questions, ready to insert. */
export function seedRows(): NewQuestion[] {
  return seed.map(makeQuestion);
}
