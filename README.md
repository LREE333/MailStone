# MailStone

A guided academic-email writing tool for students with Special Educational Needs (SEN) at the Education University of Hong Kong (EdUHK).

MailStone helps students understand which academic regulation applies to their situation, prepares a draft email grounded in that regulation, and checks the draft against 12 documented failure modes — all without calling a language model.

**Student:** LI Leer (11601718)
**Course:** LIN4049 Capstone Project
**Supervisor:** Bibi Leung (bkyleung@eduhk.hk)
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

1. **Asks guided questions** — programme type, request type, timing, situation
2. **Selects the applicable policy rule** — deterministically, from 11 verified EdUHK academic regulations
3. **Checks programme scope** — refuses to quote undergraduate clauses to postgraduate students
4. **Generates a draft email** — template-based, zero-hallucination baseline
5. **Scans the draft for 12 failure modes** — lexical, structural, and policy cross-checks
6. **Routes to SEN Support Services** — when the standard route is closed or no central rule exists

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

## Project structure

```
mailstone/
├── index.html              # Single-page app
├── css/styles.css          # Styles
├── js/
│   ├── app.js              # UI logic, question flow, draft generation
│   ├── gatekeeper.js       # Deterministic rule retrieval (no model call)
│   └── lint.js             # 12-check draft scanner
├── data/
│   ├── policy/
│   │   ├── sources.json    # 10 verified sources, scope model, known gaps
│   │   └── rules.eduhk.json # 11 rules + SEN support service, all with verbatim quotes
│   ├── quality/
│   │   └── violations.json # 12 failure modes → machine-checkable rules
│   └── exemplars/
│       ├── exemplars.json  # Annotation scheme + collection plan
│       └── corpus.json     # 18 annotated exemplars (13 public + 5 synthetic)
├── tools/
│   ├── test.mjs            # 65 assertions, all passing
│   └── lint-file.mjs       # CLI: lint any email file
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

## Tests

```bash
node tools/test.mjs
```

65 assertions covering: Gatekeeper route selection, programme scope integrity, lint detection, data integrity (every rule cites a registered source, every source declares its scope, every empty state is documented).

## Key findings

1. **EdUHK has no standalone "extenuating circumstances" policy** — confirmed by the supervisor. After a deadline has passed, the standard extension route (GAR 9.6.1) is closed.
2. **SAO SEN Support Services explicitly covers assignment deadline extensions** — the web page lists "Extension of assignment deadlines" under Lecture/Assignment Arrangements (confirmed 9 Nov 2026).
3. **The AI-tool procedure is the reimbursement scheme** — supervisor pre-approval under the reimbursement framework constitutes the complete procedural requirement (confirmed 8 Nov 2026).

## Status

| Area | Status |
|---|---|
| Policy base | 11 rules, 10 sources, all verified |
| Gatekeeper | Working, deterministic |
| Lint | 12 checks, 65 tests passing |
| Draft templates | 6 request types, 3 empty states |
| Corpus | 18 exemplars annotated (first pass) |
| AI tool procedure | Resolved |
| Model integration | Pending (LTTC LLM Studio or reimbursement) |

## Documentation

- [Project plan](docs/PLAN-2026-11-15.md)
- [Difficulties and resolutions](docs/CHALLENGES.md)
- [Deliverable checklist](docs/DELIVERABLE-2026-11-15.md)
- [Email correspondence](docs/emails/README.md)

## Disclaimer

MailStone is a student capstone project, not an official EdUHK service. Policy text is quoted from publicly available university documents but does not constitute official university advice.
