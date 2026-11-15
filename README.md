# MailStone

A guided academic-email writing tool for students with Special Educational Needs (SEN) at the Education University of Hong Kong (EdUHK).

MailStone helps students understand which academic regulation applies to their situation, prepares a draft email grounded in that regulation, checks the draft against 12 documented failure modes, finds the right office to send it to, and lets them read the interface in English, Traditional Chinese or Simplified Chinese — all without calling a language model.

**Student:** LI Leer (11601718)
**Course:** LIN4049 Capstone Project
**Supervisor:** LAU Chaak Ming (lchaakming@eduhk.hk)
**Repository:** https://github.com/LREE333/MailStone

---

## Documents

| Document | What it is |
|---|---|
| [`docs/CHALLENGES.md`](docs/CHALLENGES.md) | Every difficulty encountered, how it was resolved, and what remains open |
| [`docs/PLAN-2026-11-15.md`](docs/PLAN-2026-11-15.md) | Project plan, day-by-day schedule, decisions log, risk table |
| [`docs/DELIVERABLE-2026-11-15.md`](docs/DELIVERABLE-2026-11-15.md) | What is submitted on 15 November and how to demonstrate it |
| [`docs/emails/README.md`](docs/emails/README.md) | Log of all institutional correspondence, with question-and-answer records |

---

## What it does

1. **Asks guided questions** — programme type, request type, timing, situation, course code, teacher name, teacher email lookup, relationship with the teacher, tone
2. **Selects the applicable policy rule** — deterministically, from 11 verified EdUHK academic regulations
3. **Checks programme scope** — refuses to quote undergraduate clauses to postgraduate students
4. **Inserts the course code** — typed once in the question flow, written into every `[Course code]` slot in the draft
5. **Adapts greeting and self-introduction** — based on the student's relationship with the teacher (familiar / taught / unknown)
6. **Generates a draft email** — template-based, zero-hallucination baseline, with proper salutation, self-introduction, context, and closing
7. **Scans the draft for 12 failure modes** — lexical, structural, and policy cross-checks
8. **Routes to SEN Support Services** — when the standard route is closed or no central rule exists
9. **Suggests verified office addresses** — with a source link, staff directory lookup, and a confirmation checkbox before anything appears in the To: line
10. **Sends feedback to the backend** — the Pebble mascot's feedback feature POSTs to a configurable endpoint, with clipboard fallback if the server is unavailable
11. **Switches interface language** — EN / 繁 / 简, while the email draft and quoted policy wording stay in English

## Try it

Open `index.html` with a local web server (VS Code Live Server recommended — the browser blocks JSON fetches from `file://`).

### Demo states (URL parameters)

| URL | What it shows |
|---|---|
| `?qa=extension-pre` | Pre-deadline extension request, standard route (GAR 9.6.1) |
| `?qa=extension-post` | Post-deadline, route closed, SEN support route offered |
| `?qa=extension-tpg` | TPG student, scope gap, regulations withheld |
| `?qa=exam-ug` | Exam absence, no central rule, documented gap |
| `?qa=grade` | Grade review, 9.2.1, 14-working-day deadline |
| `?qa=extension-no-code` | "Not known yet" course code — the visible `[Course code]` blank is kept |
| `?qa=unsure` | Student has not identified a topic — the `by_design` empty state |
| `?lang=zh-Hant` / `?lang=zh-Hans` | Pins the interface to Traditional / Simplified Chinese |

`?lang=` can be combined with any `?qa=` state, e.g. `?qa=extension-pre&lang=zh-Hans`.

### The three second-iteration features

**1. Verified recipient confirmation.** `data/policy/contacts.json` is a contact directory, not a policy source: it tells the student WHERE to send, never WHAT the rules say. Only addresses printed on an official EdUHK page or in a document already registered in `sources.json` may appear. Named individuals and course lecturers are never given an invented address — where no address is published, `email` is `null` and a lookup link tells the student where to find it. Each listed address carries its `source_ids`, `source_url` and `retrieved_date`, and the student must tick a checkbox before it appears in the To: line. Nothing is sent automatically.

**2. Course code as an identifier.** The course code is collected as a free-text step, not a radio category, because it is an identifier the student supplies rather than a value the tool infers. `applyCourseCode()` substitutes the exact string into every `[Course code]` slot at the end of draft generation. Choosing "Not known yet — leave it blank" keeps the visible placeholder, which is highlighted in the review preview, counted in the copy prompt and covered by the sending checklist.

**3. Interface-only localisation.** `js/i18n.js` translates EN / 繁 / 简 via a dictionary keyed by exact English source strings plus a DOM text-node sweep. The boundary is deliberate: the generated email is always English (it is the artefact being evaluated), and verbatim policy quotations are always English (a translation would no longer be verbatim). `data-no-i18n` protects the draft and review preview; `data-verbatim` protects quotes. Language is held in memory, can be pinned with `?lang=`, and is never stored — the privacy promise is unchanged.

### Third-iteration features (2026-11-15)

**4. Email-centric result layout with notebook-edge tabs.** The result page was redesigned from a two-column grid to an email-centric layout. The generated email occupies the main panel; three notebook-edge tabs (Route, Fact Lock, "Why this structure?") slide out from the right edge on click. Each tab toggles independently via `aria-expanded`. On narrow screens, the tabs switch to horizontal.

**5. Relationship-aware draft generation.** A new question step asks how well the student knows the teacher (familiar / normal teaching / not sure). `getSelfIntroduction()` returns an empty string for "familiar" and a full intro line for the other two. `getOpeningLine()` combines the self-introduction with the context line in the right order. All three draft builders (standard, post-deadline, general) now produce: Subject → "Dear [Recipient title and surname]," → optional self-introduction + context line → reason → request → closing → "Kind regards, [Your name] [Student ID]".

**6. Feedback-to-backend.** The Pebble mascot's feedback handler now POSTs to `window.MAILSTONE_FEEDBACK_URL` with a JSON payload (`{ text, timestamp, page }`). If the server is unavailable or no endpoint is configured, the note is copied to the clipboard instead so it is never lost. The HTML text and i18n entries were updated to explain this behaviour.

**7. Staff directory source.** `EDUHK-STAFF-DIRECTORY-2026` (`https://www.eduhk.hk/en/directory`) is registered as a verified primary source. All role-only contacts (course lecturer, Faculty Dean, Programme Leader, SAppC Secretary) now cite this source and point their `lookup_url` at the official staff directory, replacing the generic Registry URL.

**8. TOEFL exam-sample genre.** Three TOEFL "Write an Email" exam-task samples were added to the corpus as a distinct genre (`origin_class: "toefl_exam_sample"`). These are timed (7-minute) responses to prompted scenarios — not real academic correspondence. They are included for pedagogical comparison: students who have prepared for TOEFL may have internalised a semi-formal register that differs from the formal academic register MailStone teaches.

## Project structure

```
mailstone/
├── index.html              # Single-page app
├── css/styles.css          # Styles
├── js/
│   ├── app.js              # UI logic, question flow, draft generation, edge tabs, feedback
│   ├── gatekeeper.js       # Deterministic rule retrieval (no model call)
│   ├── lint.js             # 12-check draft scanner
│   └── i18n.js             # EN / 繁 / 简 interface localisation
├── data/
│   ├── policy/
│   │   ├── sources.json     # 12 verified sources, scope model, known gaps
│   │   ├── rules.eduhk.json # 11 rules + SEN support service, all with verbatim quotes
│   │   └── contacts.json    # Verified office addresses + route bindings
│   ├── quality/
│   │   └── violations.json  # 12 failure modes → machine-checkable rules
│   └── exemplars/
│       ├── exemplars.json   # Annotation scheme + collection plan
│       └── corpus.json      # 18 academic + 3 TOEFL exam-sample exemplars
├── tools/
│   ├── test.mjs             # 160 assertions, all passing
│   └── lint-file.mjs        # CLI: lint any email file
└── docs/
    ├── PLAN-2026-11-15.md       # Project plan and status
    ├── DELIVERABLE-2026-11-15.md # Deliverable checklist
    ├── CHALLENGES.md            # Difficulties encountered and how they were resolved
    └── emails/                  # Email correspondence with supervisor and SAO
```

## Key design decisions

- **Deterministic rule retrieval, not vector RAG** — every output is traceable to a clause number and a verbatim quote. No embedding-based retrieval, no model hallucination.
- **Template generator is the zero-hallucination baseline** — the model (when integrated) will be compared against this baseline, not against an ungrounded generation.
- **Scope is a required field, not metadata** — a clause that governs BEd students may not govern taught master's students. The Gatekeeper withholds rather than substitutes when the student's programme is outside the collected corpus.
- **Lint is an executable failure catalogue** — negative examples are converted into 12 checkable rules, not fed to a model as "avoid this" text.
- **Never guess a personal email address** — a role named in a regulation is not an address. Published office addresses only, each traceable to a source, each requiring the student's own confirmation.
- **Personal identifiers come from the student** — the course code is inserted verbatim from their answer, or left as a visible blank. The tool never infers one.
- **Translate the interface, not the evidence** — the email and the verbatim quotes stay English so they remain checkable against the source.
- **Adapt the draft to the student–teacher relationship** — a student who knows the teacher well does not need a full self-introduction; one who may not be remembered does. The relationship step controls this without adding a model call.

## Tests

```bash
node tools/test.mjs
```

160 assertions covering: Gatekeeper route selection, programme scope integrity, lint detection, policy data integrity, recipient-registry integrity (no invented addresses, every address traceable to a registered source), course-code substitution, the localisation boundary (draft and quotes stay English in all three languages), relationship step and self-introduction logic, edge-tab panel behaviour, feedback-to-backend handler, TOEFL exam-sample corpus genre, and staff directory source registration.

## Key findings

1. **EdUHK has no standalone "extenuating circumstances" policy** — confirmed by the supervisor. After a deadline has passed, the standard extension route (GAR 9.6.1) is closed.
2. **SAO SEN Support Services explicitly covers assignment deadline extensions** — the web page lists "Extension of assignment deadlines" under Lecture/Assignment Arrangements (confirmed 9 Nov 2026).
3. **The AI-tool procedure is the reimbursement scheme** — supervisor pre-approval under the reimbursement framework constitutes the complete procedural requirement (confirmed 8 Nov 2026).
4. **Official EdUHK pages publish office addresses, not personal ones** — the University Contact Us page and the SAO SEN Support Services page supply office addresses; the GAR names roles (lecturer, Dean, Programme Leader, SAppC secretary) but prints no address for them. This is why the recipient panel withholds rather than guesses.

## Status

| Area | Status |
|---|---|
| Policy base | 11 rules, 12 sources, all verified |
| Verified contact registry | 10 contacts, 6 published office addresses, 6 route bindings, staff directory linked |
| Gatekeeper | Working, deterministic |
| Lint | 12 checks, 160 tests passing |
| Draft templates | 6 request types, 3 empty states, relationship-aware greeting/intro |
| Course code step | Working, with "not known yet" blank |
| Interface languages | EN / 繁 / 简; draft + quotes always English |
| Result layout | Email-centric with notebook-edge tabs (Route, Fact Lock, Why this structure?) |
| Feedback | POST to backend with clipboard fallback |
| Corpus | 18 academic + 3 TOEFL exam-sample exemplars annotated |
| AI tool procedure | Resolved |
| Model integration | Pending (LTTC LLM Studio or reimbursement) |

## Documentation

- [Project plan](docs/PLAN-2026-11-15.md)
- [Difficulties and resolutions](docs/CHALLENGES.md)
- [Deliverable checklist](docs/DELIVERABLE-2026-11-15.md)
- [Email correspondence](docs/emails/README.md)

## Disclaimer

MailStone is a student capstone project, not an official EdUHK service. Policy text is quoted from publicly available university documents but does not constitute official university advice. Contact addresses are leads, not verified destinations — the student must confirm them on the official page before sending.
