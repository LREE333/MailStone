# MailStone

A guided academic-email writing tool for students with Special Educational Needs (SEN) at the Education University of Hong Kong (EdUHK).

MailStone helps students understand which academic regulation applies to their situation, prepares a draft email grounded in that regulation, checks the draft against 12 documented failure modes, suggests source-backed recipient leads, and lets them read the interface in English, Traditional Chinese or Simplified Chinese — all without calling a language model.

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

1. **Asks guided questions** — programme first, request second; extension, absence, exam, grade and review requests immediately get a date step, then course code, teacher name, contact selection, relationship and request-specific questions
2. **Selects the applicable policy rule** — deterministically, from 11 source-backed rules (10 verbatim and 1 explicitly labelled derivation)
3. **Checks programme scope** — refuses to quote undergraduate clauses to postgraduate students; handbook scope still carries `needs_confirmation` in the source data
4. **Inserts supplied identifiers and dates** — course code and teacher name are supplied by the student; selected preferred dates remain requests, never approval
5. **Adapts greeting and self-introduction** — based on the student's relationship with the teacher (familiar / taught / unknown)
6. **Generates a draft email** — template-based, zero-hallucination baseline, with salutation, optional self-introduction, context and closing
7. **Scans the draft for 12 failure modes** — lexical, structural and policy cross-checks
8. **Routes to SEN Support Services** — when the standard route is closed or no central rule exists; retrospective accommodation remains unestablished
9. **Suggests published contact leads** — 6 office addresses and a local 18-person LML snapshot, with explicit candidate selection, manual/unknown fallback and final recipient confirmation before the To: line
10. **Offers configurable feedback POST** — the frontend attempts a configured endpoint, with clipboard/manual-copy fallback; this does not establish a deployed backend
11. **Switches interface language and display** — EN / 繁 / 简, plus Pebble's Display dark-mode toggle; the email draft and quoted policy wording stay English

## Try it

Open `index.html` with a local web server (VS Code Live Server recommended — the browser blocks JSON fetches from `file://`). The website is **not yet live**; the latest local changes have not been pushed.

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

`?lang=` can be combined with any `?qa=` state, e.g. `?qa=extension-pre&lang=zh-Hans`. These shortcuts are demonstration presets, not evidence that the latest full question flow has passed browser validation.

### The three second-iteration features

**1. Source-backed recipient confirmation.** `data/policy/contacts.json` is a contact directory, not a policy source: it tells the student WHERE to send, never WHAT the rules say. Only addresses printed on an official EdUHK page or in a document already registered in `sources.json` may appear as source-backed leads. Named individuals and course lecturers are never given an invented address — where no address is collected, `email` is `null` and a lookup link offers a manual fallback. Each listed address carries its `source_ids`, `source_url` and `retrieved_date`, and the student must tick a checkbox before it appears in the To: line. Nothing is sent automatically. A source-verified public address is not a verified current destination.

**2. Course code as an identifier.** The course code is collected as a free-text step, not a radio category, because it is an identifier the student supplies rather than a value the tool infers. `applyCourseCode()` substitutes the exact string into every `[Course code]` slot at the end of draft generation. Choosing "Not known yet — leave it blank" keeps the visible placeholder, which is highlighted in the review preview, counted in the copy prompt and covered by the sending checklist.

**3. Interface-only localisation.** `js/i18n.js` translates EN / 繁 / 简 via a dictionary keyed by exact English source strings plus a DOM text-node sweep. The boundary is deliberate: the generated email is always English (it is the artefact being evaluated), and verbatim policy quotations are always English (a translation would no longer be verbatim). `data-no-i18n` protects the draft and review preview; `data-verbatim` protects quotes. Language is held in memory, can be pinned with `?lang=`, and is never stored — the privacy promise is unchanged.

### Third-iteration features (2026-11-15)

**4. Email-centric result layout with notebook-edge tabs.** The result page was redesigned from a two-column grid to an email-centric layout. The generated email occupies the main panel; three colored notebook-edge tabs (Route, Fact Lock, "Why this structure?") open bounded reference drawers. Only one drawer can be open at a time; clicking its tab again, the close button or Escape closes it. Close/Escape returns focus to the relevant tab. On narrow screens, the tabs switch to horizontal. Latest browser/layout validation is underway, not yet claimed complete.

**5. Relationship-aware draft generation.** A question step asks how well the student knows the teacher (familiar / normal teaching / not sure). `getSelfIntroduction()` returns an empty string for "familiar" and a full intro line for the other two. `getOpeningLine()` combines the self-introduction with the context line in the right order. All three draft builders (standard, post-deadline, general) produce: Subject → salutation → optional self-introduction + context line → reason → request → closing → "Kind regards, [Your name] [Student ID]".

**6. Configurable feedback frontend.** The Pebble mascot's feedback handler attempts a POST to `window.MAILSTONE_FEEDBACK_URL` with a JSON payload (`{ text, timestamp, page }`). If no endpoint is configured or the request fails, it attempts clipboard copying and provides manual-copy guidance if needed. Implemented frontend code and static tests do not prove backend deployment, storage or successful end-to-end delivery.

**7. Staff sources and local matching.** `EDUHK-STAFF-DIRECTORY-2026` (`https://www.eduhk.hk/en/directory`) remains registered and linked for optional lookup, not a readable cross-origin JSON email API. On-page matching uses only the local 18-person LML contact snapshot sourced to `https://www.eduhk.hk/lml/people` (`EDUHK-LML-STAFF-2026`, retrieved 15 Nov). It is not a live whole-University search. The only course association is LIN4049 → LAU, historically **2025-26 S2 group 31E** (`EDUHK-LIN4049-2025-26`); it does not establish current teaching or override a conflicting supplied name. Candidates require explicit selection; an unmatched/ambiguous name is never turned into a guessed email. Manual university-email entry and continuing without an address remain available. Course/name/email edits revoke stale teacher-address confirmation; programme/request/timing changes clear route confirmations.

**8. TOEFL exam-sample genre.** The corpus has three entries tagged `origin_class: "toefl_exam_sample"`, but only **two retrieved full-text samples** (EX-019, EX-020). Wofo EX-021 is a metadata-only record of a consulted platform, not a retrieved or annotated email. EX-019 is attributed to ETS and its full text was retrieved through the recorded Zhihu reprint (`source_locator`); checking all 14 actual `sources.json` entries finds no ETS/TOEFL source ID, including `ETS-TOEFL-2026`. ETS is recorded in `corpus.json.sources_consulted`, not registered in the policy-source registry. Direct ETS primary-source comparison remains pending; the reprint attribution is not independent verification. Exam-task responses are included for genre comparison, not real academic correspondence or policy evidence.

### Latest local intake and display updates

- **Explicit year/month/day selectors:** immediately after each time-related request, two request-specific date fields use labelled native `<select size="5">` lists. "Choose a date" opens them; "Use this date" records the choice; each date can explicitly remain undecided. Invalid calendar dates and reversed extension/absence ranges are checked. Preferred reply-by dates do not replace the formal 14-working-day policy window.
- **Fact Lock code/date bug fixed:** a supplied course code no longer appears in the missing-facts list; supplied teacher name/email and explicitly selected dates are displayed. A selected preferred deadline replaces the obsolete missing-duration message. Unknown fields remain visibly unresolved. "Provided by you / selected by you" is provenance, not official verification; approval still says "Not yet approved" and supporting documents remain unconfirmed.
- **Display dark mode:** Pebble → Display → Dark mode is implemented with pressed-state feedback; colored tabs and one-at-a-time drawers are implemented. Browser checks of the latest interactions, languages, focus and responsive layouts are still underway.

Date fields are request-specific: extension = original deadline / preferred new deadline; absence = first / last day; exam = scheduled date / preferred alternative; grade = result release / preferred reply-by; review = decision notification / preferred reply-by. The year/month/day lists do not save their initial displayed date until the student clicks "Use this date".

### Latest corrections (15 Nov, second pass)

The separate "Has the deadline passed?" question has been merged into the date step: the first date the student enters now decides whether the route is open, and an undecided date stays undecided. The default type size moved from 16px to 17px, with small body copy lifted to 0.9rem. The footer became one bar with a stone mark and a bordered disclaimer pill, and the result page now states that the draft text is selectable while the Copy button also runs the self-check list and Fact Lock. 214 assertions pass. The result page was measured in Chrome at 127.0.0.1 for font size, footer fit and internal scrolling; a full click-through of every branch is still outstanding.

## Project structure

```
mailstone/
├── index.html              # Single-page app
├── css/styles.css          # Styles
├── js/
│   ├── app.js              # UI logic, dates, local staff matching, drafts, tabs, feedback
│   ├── gatekeeper.js       # Deterministic rule retrieval (no model call)
│   ├── lint.js             # 12-check draft scanner
│   └── i18n.js             # EN / 繁 / 简 interface localisation
├── data/
│   ├── policy/
│   │   ├── sources.json     # 14 registered sources with mixed verification statuses
│   │   ├── rules.eduhk.json # 11 rules (10 verbatim + 1 derived) + SEN support service
│   │   └── contacts.json    # 10 route contacts + 18-person LML snapshot + 1 historical link
│   ├── quality/
│   │   └── violations.json  # 12 failure modes → machine-checkable rules
│   └── exemplars/
│       ├── exemplars.json   # Annotation scheme + collection plan
│       └── corpus.json      # 18 academic + 2 full-text TOEFL + 1 Wofo metadata record
├── tools/
│   ├── test.mjs             # 214 automated assertions passing; not browser validation
│   └── lint-file.mjs        # CLI: lint any email file
└── docs/
    ├── PLAN-2026-11-15.md       # Project plan and status
    ├── DELIVERABLE-2026-11-15.md # Deliverable checklist
    ├── CHALLENGES.md            # Difficulties encountered and how they were resolved
    └── emails/                  # Email correspondence with supervisor and SAO
```

## Key design decisions

- **Deterministic rule retrieval, not vector RAG** — every output is traceable to a clause number and a verbatim quote; the one derived rule is labelled. No embedding-based retrieval, no model hallucination.
- **Template generator is the zero-hallucination baseline** — the model (when integrated) will be compared against this baseline, not against an ungrounded generation.
- **Scope is a required field, not metadata** — a clause that governs BEd students may not govern taught master's students. The Gatekeeper withholds rather than substitutes when the student's programme is outside the collected corpus. The inferred handbook applicability still needs institutional confirmation.
- **Lint is an executable failure catalogue** — negative examples are converted into 12 checkable rules, not fed to a model as "avoid this" text.
- **Never guess a personal email address** — official pages can publish individual work addresses (LML does), but publication alone establishes neither current teaching nor the correct destination. Each candidate needs explicit selection and final student confirmation.
- **Personal identifiers come from the student** — course/name/email and preferred dates are supplied or explicitly selected, never inferred as approved facts.
- **Translate the interface, not the evidence** — the email and the verbatim quotes stay English so they remain checkable against the source.
- **Adapt the draft to the student–teacher relationship** — a student who knows the teacher well does not need a full self-introduction; one who may not be remembered does. The relationship step controls this without adding a model call.
- **Keep contact reuse narrow** — the 18-person snapshot contains factual public work contacts with attribution, not biographies or a live feed. Permission for wider public-contact reuse/maintenance has not been obtained; expansion remains pending.

## Tests

```bash
node tools/test.mjs
```

**214 passed, 0 failed** on the current local files (15 Nov 2026). Coverage includes Gatekeeper routes and scope, lint and data integrity, source-backed recipient handling, identifier substitution, localisation boundaries, relationship logic, date validity and substitution, local staff matching and historical course limits, stale-confirmation invalidation, Fact Lock intake, dark-toggle markup, notebook drawer logic and configurable feedback frontend checks. Some UI checks inspect source text or use stubs; this is not end-to-end browser or deployed-backend validation. Earlier second-iteration headless-browser findings remain historical; actual browser testing of the latest changes is underway.

## Key findings

1. **EdUHK has no standalone "extenuating circumstances" policy** — confirmed by the supervisor. After a deadline has passed, the standard extension route (GAR 9.6.1) is closed.
2. **SAO SEN Support Services explicitly covers assignment deadline extensions** — the web page lists "Extension of assignment deadlines" under Lecture/Assignment Arrangements (confirmed 9 Nov 2026). Retrospective availability is still not established.
3. **The AI-tool procedure is the reimbursement scheme** — supervisor pre-approval under the reimbursement framework constitutes the complete procedural requirement (confirmed 8 Nov 2026).
4. **Address availability depends on the source** — the University Contact Us and SAO pages supplied office addresses; GAR names roles but prints no addresses for them. The later LML page does publish individual work addresses. The original office-only finding must not be generalised to all official EdUHK pages.

## Status

Counts below are checked against actual `contacts.json`, `sources.json` and `corpus.json` entries, not copied blindly from summary metadata. The corpus has 20 full-text records and 1 metadata record; the 18 first-pass academic annotations include the negative EX-018, leaving 17 academic records outside that explicitly labelled negative example. All 9 consulted corpus-source records are separate from the 14 policy/contact-source registrations.

| Area | Status |
|---|---|
| Policy base | 11 rules (10 verbatim + 1 derived); 14 registered sources: 10 primary, 1 secondary, 1 oral, 2 identified/not retrieved |
| Contact registry | 10 route contacts: 6 office addresses + 4 withheld roles; separately 18 LML staff, 1 historical course link; 6 route bindings; 24 unique published addresses |
| Gatekeeper | Working, deterministic; inferred handbook scope still needs confirmation |
| Lint / automated suite | 12 checks; 214 automated assertions passing |
| Draft templates | 6 request types, 3 documented empty states, relationship-aware greeting/intro |
| Intake / Fact Lock | Programme → request → dates where relevant; course/name/email and preferred dates shown without verified-approval claims |
| Interface / Display | EN / 繁 / 简; draft + quotes always English; dark-mode toggle implemented |
| Result layout | Colored notebook tabs; one drawer at a time; close/Escape implemented |
| Feedback | Configurable POST frontend + clipboard/manual fallback; deployed backend not established |
| Corpus | 21 records: 18 academic (13 public + 5 synthetic, including 1 negative) + 2 full-text TOEFL + 1 Wofo metadata-only; 0 double-coded |
| Latest browser validation | Underway; no latest validation claim yet |
| Publication | Not live; latest changes unpushed; `b5d8618` is the historical last pushed commit |
| GitHub Pages | Management authentication missing; one-time Settings > Pages, branch `main`, folder `/ (root)` setup pending |
| Contact reuse permission | Wider feed permission not obtained; narrow snapshot/current-teaching limitations apply |
| AI tool procedure | Resolved |
| Model integration | Pending (LTTC LLM Studio or reimbursement) |

Publication final status will be added by the parent after authentication, the latest push and Pages setup/deployment are actually completed. This documentation update does not perform those actions.

## Documentation

- [Project plan](docs/PLAN-2026-11-15.md)
- [Difficulties and resolutions](docs/CHALLENGES.md)
- [Deliverable checklist](docs/DELIVERABLE-2026-11-15.md)
- [Email correspondence](docs/emails/README.md)

## Disclaimer

MailStone is a student capstone project, not an official EdUHK service. Policy text is quoted from publicly available university documents but does not constitute official university advice. Contact addresses are source-backed leads, not verified current destinations — the student must confirm the person, current teaching/role and address before sending. Preferred dates and Fact Lock intake are not approval. Public availability is not permission for a wider maintained contact feed.
