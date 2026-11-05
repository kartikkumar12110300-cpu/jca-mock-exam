import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ensureIndexes } from "@/lib/db/indexes";
import { papers, questions, users } from "@/lib/db/collections";
import type {
  Difficulty,
  KeyStatus,
  QuestionDoc,
  QuestionStatus,
  SourceType,
} from "@/lib/db/types";
import { hashPassword } from "@/lib/auth/password";
import { adminUsername } from "@/lib/env";
import { SECTION_IDS, type SectionId } from "@/lib/exam/pattern";

interface RawQuestion {
  section: string;
  topic?: string;
  difficulty?: string;
  stem: string;
  options: string[];
  answer?: string | number;
  bonus?: boolean;
  explanation?: string;
  sourceRef?: string;
  tags?: string[];
}

interface RawPaper {
  paper: {
    title: string;
    source: string;
    sourceType?: string;
    keyStatus?: string;
    status?: string;
  };
  questions: RawQuestion[];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function contentHash(question: RawQuestion): string {
  const payload = [
    "v1",
    question.section,
    normalize(question.stem),
    question.options.map(normalize).join("|"),
  ].join("::");
  return createHash("sha256").update(payload).digest("hex");
}

function correctIndex(answer: string | number | undefined, bonus: boolean): number | null {
  if (bonus) return null;
  if (typeof answer === "number") {
    if (answer >= 1 && answer <= 4) return answer - 1;
    if (answer >= 0 && answer <= 3) return answer;
    return null;
  }
  if (!answer) return null;
  const letter = answer.trim().toUpperCase();
  if (letter === "A") return 0;
  if (letter === "B") return 1;
  if (letter === "C") return 2;
  if (letter === "D") return 3;
  if (["1", "2", "3", "4"].includes(letter)) return Number(letter) - 1;
  return null;
}

function asDifficulty(value: string | undefined): Difficulty {
  return value === "easy" || value === "hard" ? value : "medium";
}

function asKeyStatus(value: string | undefined): KeyStatus {
  return value === "official" || value === "disputed" ? value : "unofficial";
}

function asStatus(value: string | undefined): QuestionStatus {
  return value === "draft" || value === "in_review" || value === "retired"
    ? value
    : "published";
}

function asSourceType(value: string | undefined): SourceType {
  return value === "manual" || value === "topic" ? value : "pyq";
}

async function seedUsers(): Promise<{ created: number; existing: number }> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required to seed the admin account");
  }

  const userPasswords = (process.env.SEED_USER_PASSWORDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (userPasswords.length === 0) {
    throw new Error("SEED_USER_PASSWORDS is required to seed user accounts");
  }

  const seeds = [
    {
      username: adminUsername().toLowerCase(),
      password: adminPassword,
      role: "admin" as const,
      displayName: "Administrator",
    },
    ...userPasswords.map((password, index) => ({
      username: `user${index + 1}`,
      password,
      role: "user" as const,
      displayName: `User ${index + 1}`,
    })),
  ];

  const force = process.env.SEED_FORCE_PASSWORD === "true";
  let created = 0;
  let existing = 0;
  const collection = await users();

  for (const seed of seeds) {
    const found = await collection.findOne({ username: seed.username });
    if (found) {
      existing += 1;
      if (force) {
        await collection.updateOne(
          { _id: found._id },
          {
            $set: {
              passwordHash: await hashPassword(seed.password),
              tokenVersion: (found.tokenVersion ?? 0) + 1,
              mustChangePassword: true,
            },
          },
        );
      }
      continue;
    }

    await collection.insertOne({
      _id: crypto.randomUUID(),
      username: seed.username,
      passwordHash: await hashPassword(seed.password),
      role: seed.role,
      displayName: seed.displayName,
      active: true,
      // Seeded passwords are shared and published, so force a personal one.
      tokenVersion: 0,
      mustChangePassword: true,
      createdAt: new Date(),
      lastLoginAt: null,
    });
    created += 1;
  }

  return { created, existing };
}

async function seedQuestions(): Promise<{ inserted: number; skipped: number; papers: number }> {
  const contentDir = path.join(process.cwd(), "content");
  const files = (await readdir(contentDir))
    .filter((file) => file.endsWith(".json"))
    .sort();

  let inserted = 0;
  let skipped = 0;
  let paperCount = 0;
  const questionCollection = await questions();
  const paperCollection = await papers();

  for (const file of files) {
    const raw = JSON.parse(
      await readFile(path.join(contentDir, file), "utf8"),
    ) as RawPaper;
    if (!raw.paper || !Array.isArray(raw.questions)) {
      console.warn(`skip ${file}: missing paper or questions`);
      continue;
    }

    const paperId = `paper-${slug(file.replace(/\.json$/, ""))}`;
    await paperCollection.updateOne(
      { _id: paperId },
      {
        $setOnInsert: {
          _id: paperId,
          title: raw.paper.title,
          source: raw.paper.source,
          sourceType: asSourceType(raw.paper.sourceType),
          keyStatus: asKeyStatus(raw.paper.keyStatus),
          status: asStatus(raw.paper.status),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    paperCount += 1;

    const operations = [];
    for (const question of raw.questions) {
      if (!SECTION_IDS.includes(question.section as SectionId)) {
        console.warn(`skip ${file}: unknown section ${question.section}`);
        skipped += 1;
        continue;
      }
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        console.warn(`skip ${file}: question does not have 4 options`);
        skipped += 1;
        continue;
      }

      const isBonus = Boolean(question.bonus);
      const index = correctIndex(question.answer, isBonus);
      if (!isBonus && index === null) {
        console.warn(`skip ${file}: question has no usable answer`);
        skipped += 1;
        continue;
      }

      const doc: QuestionDoc = {
        _id: crypto.randomUUID(),
        sectionId: question.section,
        topic: question.topic || "",
        difficulty: asDifficulty(question.difficulty),
        stem: question.stem,
        options: question.options,
        correctIndex: index,
        isBonus,
        keyStatus: asKeyStatus(raw.paper.keyStatus),
        explanation: question.explanation || "",
        sourceRef: question.sourceRef || null,
        sourceType: asSourceType(raw.paper.sourceType),
        paperId,
        status: asStatus(raw.paper.status),
        tags: question.tags || [],
        contentHash: contentHash(question),
        createdAt: new Date(),
      };

      operations.push({
        updateOne: {
          filter: { contentHash: doc.contentHash },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      const result = await questionCollection.bulkWrite(operations, { ordered: false });
      inserted += result.upsertedCount;
      skipped += operations.length - result.upsertedCount;
    }
  }

  return { inserted, skipped, papers: paperCount };
}

async function main(): Promise<void> {
  console.log("Creating indexes...");
  await ensureIndexes();

  console.log("Seeding accounts...");
  const accountResult = await seedUsers();
  console.log(
    `Accounts: ${accountResult.created} created, ${accountResult.existing} already existed.`,
  );

  console.log("Importing question bank...");
  const questionResult = await seedQuestions();
  const total = await (await questions()).countDocuments({ status: "published" });
  console.log(
    `Questions: ${questionResult.inserted} inserted, ${questionResult.skipped} skipped, ${total} published total.`,
  );
  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
