# Content pipeline

Every question in the app comes from a JSON file in this folder. One file is one
paper or one topic batch. Import with:

```bash
npm run import -- content/constitution-124-147.json
npm run import -- content/                      # every .json in the folder
npm run import -- content/my-paper.json --dry-run
```

The importer validates the whole file first, then inserts. Questions are
deduplicated by a hash of the normalised stem + options, so re-running an import
is a no-op — safe to repeat after adding questions to the same file.

## File format

```json
{
  "paper": {
    "title": "SCI JCA 2022 — 27 September",
    "source": "JCA_2022_27Sep.pdf",
    "sourceType": "pyq",
    "keyStatus": "unofficial",
    "status": "published"
  },
  "questions": [
    {
      "section": "constitution",
      "topic": "Article 145 — rules of court",
      "difficulty": "medium",
      "stem": "Which Article empowers the Supreme Court to make rules of procedure?",
      "options": ["141", "144", "145", "146"],
      "answer": "C",
      "explanation": "Article 145 is the enabling provision for the Supreme Court Rules, 2013.",
      "sourceRef": "Q37",
      "tags": ["article-145"]
    }
  ]
}
```

- `section` must be one of the ids in `lib/pattern.ts`: `english`, `aptitude`,
  `gk`, `constitution`, `sc-rules-2013`, `sci-rules-1961`, `computer`.
- `answer` is `1`–`4` or `"A"`–`"D"`. Omit it and set `"bonus": true` for a
  question where full marks go to everyone.
- `paper.keyStatus` applies to every question in the file unless a question
  overrides it. Use `official` only when the answer is verified against the
  official source (statute, notification, official answer key), `unofficial`
  when you or a third-party key worked it out, `disputed` when the key is
  contested.
- `status`: `published` (playable), `draft` (in the bank but not served),
  `in_review`, `retired`.
- `explanation` and `sourceRef` are shown on the result page — write them for
  the question you got wrong at 11 p.m., not for a textbook.
- Stems support `**bold**` only.

## Previous-year papers

The PDFs in `01_Previous_Year_Papers/` are **image-only**:

| File | What it actually is |
|---|---|
| `JCA_2022_26Sep_Shift1/2.pdf`, `JCA_2022_27Sep.pdf` | candidate **response sheets** — question IDs, option IDs, the candidate's answer. No question text, no answer key. |
| `JCA_2025_13Apr.pdf`, `JCA_2017_17Sep.pdf` | scanned papers. No text layer, so they need OCR before they can be transcribed. |
| `03_Answer_Keys/JCA_2025_*` | the objection notice and the revised-key notice (which marks three question IDs as all-candidates-get-one-mark). The key itself was published on the portal, not in these PDFs. |

So PYQ import is a transcription job, not a parsing job. Once a paper is
transcribed into the format above (or OCR'd and cleaned), importing it is one
command. Mark such files `"keyStatus": "unofficial"` unless you are working from
the official key, and set `"bonus": true` for the three 2025 question IDs in the
revised-key notice.

### Already transcribed

These papers are transcribed and live in this folder, so a fresh install seeds
them automatically:

| File | Questions | Notes |
|---|---|---|
| `JCA_2017_17Sep.json` | 125 | legacy 125-question paper, 50 English |
| `JCA_2022_26Sep_Shift1.json` | 124 | |
| `JCA_2022_26Sep_Shift2.json` | 120 | |
| `JCA_2022_27Sep.json` | 115 | |
| `JCA_2025_13Apr.json` | 125 | the 3 revised-key bonus questions are **not** flagged yet — their official IDs are not mappable to the transcribed numbering without OCR |

All five are `keyStatus: "unofficial"`. Re-importing is safe: dedupe by content
hash skips anything already in the database.
