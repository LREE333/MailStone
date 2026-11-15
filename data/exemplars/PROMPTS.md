# Prompt templates for synthetic email samples

**Purpose.** Generate a larger set of English email samples without pretending they are real student emails. The point is coverage: six request types, three relationships, three tones, plus a set of deliberately flawed emails that the 12 lint checks should catch.

**Why the wording is fixed.** If the prompt changes between samples, the samples are no longer comparable, and any count ("18 of 24 used a modal request") becomes meaningless. Fill in the slots, change nothing else.

---

## Three rules

1. **One sample per run.** Start a new chat for each email. Generating twenty in one conversation makes the later ones drift towards each other.
2. **Never edit the output by hand.** If a sample is wrong, regenerate it. Hand-edited output cannot be described honestly as model output.
3. **Label it.** `provenance: "synthetic_ai"`. Never `public_model`, and never `synthetic_verified` — that class already means a synthetic sample that a person wrote and checked. Mixing the two makes the corpus statistics wrong.

---

## Before you start: the scenario list

Eighteen scenarios. Each one is a single run of Prompt A.

| ID | Request type | Relationship | Tone | Timing | Facts to put in the email |
|---|---|---|---|---|---|
| S01 | extension | taught | warm | before deadline | Essay 2, LIN4049, due 28 Nov, health issue, asks for 5 Dec |
| S02 | extension | unknown | formal | before deadline | Essay 2, LIN4049, due 28 Nov, paid work hours increased, asks for 3 Dec |
| S03 | extension | familiar | concise | before deadline | Essay 2, LIN4049, due 28 Nov, two overlapping deadlines, asks for 2 Dec |
| S04 | extension | taught | warm | after deadline | Essay 2, LIN4049, due 14 Nov, family matter, asks whether anything can still be done |
| S05 | absence | taught | warm | before event | Tutorial, LIN3044, 21 Nov, medical appointment, asks what to submit |
| S06 | absence | unknown | formal | after event | Lecture, LIN3044, 19 Nov, was unwell, asks whether a record is needed |
| S07 | absence | familiar | concise | before event | Seminar, LIN4049, 24 Nov, competition, asks about catch-up work |
| S08 | exam | unknown | formal | before exam | LIN4049 written exam, 8 Dec, clash with another paper, asks about the procedure |
| S09 | exam | taught | warm | after exam | LIN4049 exam, 2 Dec, missed it through illness, asks what to do |
| S10 | grade | taught | formal | within two weeks | Essay 1, LIN4049, result released 10 Nov, asks for clarification of one criterion |
| S11 | grade | unknown | warm | within two weeks | Essay 1, LIN4049, result released 11 Nov, does not understand the feedback on structure |
| S12 | grade | familiar | concise | more than two weeks | Essay 1, LIN4049, result released 20 Oct, asks whether a review is still possible |
| S13 | review | taught | formal | decision issued | Progression decision, 12 Nov, asks how to request a review |
| S14 | review | unknown | warm | no decision yet | Suspected marking error, no formal decision, asks who to contact |
| S15 | meeting | familiar | warm | n/a | Wants 15 minutes about the capstone topic |
| S16 | meeting | taught | formal | n/a | Wants to discuss feedback before the next assignment |
| S17 | meeting | unknown | concise | n/a | Needs to confirm which supervisor is assigned |
| S18 | extension | taught | warm | before deadline | Group project, LIN3044, due 30 Nov, teammate withdrew, asks for 7 Dec |

---

## Prompt A — a good sample

Copy everything inside the block, fill the `{{ }}` slots, send once.

```text
You are writing a model academic email for a university corpus. The corpus is used to teach students how to write to a lecturer.

Write ONE email in English, 110-170 words, from a student to a lecturer at a Hong Kong university.

Scenario:
- Request type: {{request_type}}
- Relationship with the lecturer: {{relationship}}   (familiar = has spoken to them before; taught = has attended their class but is not known personally; unknown = has never spoken to them)
- Tone: {{tone}}   (warm = friendly but respectful; formal = neutral and precise; concise = short, no small talk)
- Course code: {{course_code}}
- Assessment or event: {{assessment}}
- Timing: {{timing}}
- Reason the student gives: {{reason}}
- Date the student asks for, if any: {{preferred_date}}

Rules:
1. Use British English and an academic register. Use "Dear Dr <Surname>," except when the relationship is familiar, where "Dear <First name>," is allowed.
2. The first sentence gives context. Do not open with an apology.
3. Include exactly ONE request sentence, and use a modal (could / would / may I ask).
4. Do not claim that a document is attached. If evidence is offered, say it can be provided.
5. Do not say or imply that the request has been approved, granted or accepted.
6. Do not name a diagnosis, a disability or a medical condition.
7. Use at most one apology marker.
8. Acknowledge the effect on the lecturer or on the marking, in one sentence.
9. End with a one-line closing, then "Kind regards," on its own line, then [Your name] and [Student ID].
10. The only square-bracket placeholders allowed are [Your name], [Student ID], [Course code] and [Assignment name].
11. Output the email text only. No headings, no notes, no explanation before or after.
```

---

## Prompt B — a deliberately flawed sample

These are for testing the lint. One flaw per sample, named explicitly.

```text
You are writing a realistic but flawed academic email for a corpus. The corpus tests whether a checking tool can catch common mistakes.

Write ONE email in English, 90-160 words, from a student to a lecturer at a Hong Kong university.

Scenario:
- Request type: {{request_type}}
- Relationship with the lecturer: {{relationship}}
- Course code: {{course_code}}
- Assessment or event: {{assessment}}

The email must contain exactly this flaw, and no other deliberate flaw:
{{flaw}}

Write it the way a real student would write it when they are tired or in a hurry. Do not exaggerate the flaw into parody, and do not draw attention to it. Output the email text only.
```

**Flaw values, one per run:**

| Value | What the email must do | Lint check it should trigger |
|---|---|---|
| `presumptive_approval` | Thank the lecturer for granting the extension before it is granted | V01 |
| `attachment_claim` | Say a medical certificate is attached when nothing is attached | V02 |
| `multiple_requests` | Ask for an extension and also ask for a reference and a meeting | V08 |
| `no_request` | Describe the problem and stop, with no clear ask | V06 |
| `over_apology` | Apologise four or five times | V04 |
| `demanding` | Use "You must" or "I need you to" | V05 |
| `sensitive_disclosure` | Name a diagnosis in detail | V07 |
| `missing_identifiers` | Never give a course code or an assignment name | V09 |
| `register_mismatch` | Open with "Hey" and close with "Cheers" | V10 |
| `premature_escalation` | Threaten a formal appeal in the first email | V11 |
| `missing_date` | Ask for an extension without any date at all | V12 |
| `vague_request` | Ask for "some help with the assignment" | V06 |

---

## Output format

Paste each email into `corpus.json` as a new record. The fields below match the existing records, so the file stays valid.

```json
{
  "exemplar_id": "EX-022",
  "provenance": "synthetic_ai",
  "source_name": "Prompt A · scenario S01",
  "source_url": null,
  "request_type": "extension",
  "timing": "before_deadline",
  "register": "warm_respectful",
  "policy_rules": [],
  "text": "...",
  "moves": ["M1_SALUTATION", "M2_IDENTITY", "M3_PURPOSE", "M4_CONTEXT", "M5_REQUEST", "M6_CONSTRAINT_ACK", "M8_CLOSING"],
  "missing_moves": [],
  "politeness_features": {
    "apology_marker": 0,
    "formal_address": true,
    "gratitude_marker": 1,
    "hedging": true,
    "imposition_acknowledgement": true,
    "indirect_request_form": true,
    "modal_mitigation": true,
    "self_deprecation": false
  },
  "accessibility_features": {
    "distinct_request_count": 1,
    "max_sentence_length_words": 24,
    "mean_sentence_length_words": 15.0,
    "sentence_count": 6,
    "unresolved_placeholder_count": 3
  },
  "annotation_note": "",
  "generator": {
    "model": "",
    "date": "",
    "prompt": "A",
    "scenario_id": "S01",
    "reviewed_by": ""
  }
}
```

`register` values in use: `formal`, `semi_formal`, `warm_respectful`, `apologetic_respectful`, `overfamiliar`.

`moves` values in use: `M1_SALUTATION`, `M2_IDENTITY`, `M3_PURPOSE`, `M4_CONTEXT`, `M5_REQUEST`, `M6_CONSTRAINT_ACK`, `M7_REMEDY`, `M8_CLOSING`.

---

## Review checklist

Run this before a sample counts as data. Anything that fails, regenerate — do not patch the text.

- [ ] Exactly one request sentence, and it contains a modal
- [ ] No claim that a document is attached
- [ ] No claim that the request is approved
- [ ] No diagnosis, disability or condition named
- [ ] At most one apology
- [ ] Course code and assessment name both present
- [ ] Any date mentioned is consistent from start to finish
- [ ] It reads like a person wrote it, not like a template with blanks filled
- [ ] It is not simply a paraphrase of MailStone's own template

The last two are the ones that decide whether the sample is usable as a *reference*. If a sample is only a rewrite of our template, it proves nothing about how students actually write.

---

## Recording sheet

Keep one row per sample, outside the corpus file, so the count can be checked later.

| Exemplar | Scenario | Prompt | Model | Date | Reviewed by | Pass / Regenerate |
|---|---|---|---|---|---|---|
| EX-022 | S01 | A | | | | |
| EX-023 | S02 | A | | | | |

**Target mix**

| Layer | Count | Role |
|---|---|---|
| Real, with consent | 5–10 | Anchors what authentic writing looks like |
| Public model emails (writing centres) | 10–15 | Already partly collected |
| Synthetic, AI-generated | 24–30 | Coverage of scenario, tone and relationship |
| Synthetic, deliberately flawed | 12 | One per lint check |

The flawed set is the cheapest and the most useful: it costs one run per check, and it tests the part of the system that makes a claim about quality.
