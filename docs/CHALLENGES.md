# MailStone — Difficulties Encountered and How They Were Resolved

**Student:** LI Leer (11601718)
**Course:** LIN4049, EdUHK
**Date:** 9 November 2026
**Last updated:** 15 November 2026 (latest local intake/contact/display changes; source, validation and publication claims corrected)

**Current evidence boundary:** 214 automated assertions pass on the local files. The result page has since been re-measured in Chrome at 127.0.0.1 (17px root, 15.3px self-check text, one 53px footer row, no page-level overflow, `main.app-main` as the only scrolling region besides the draft textarea). A branch-by-branch click-through is still outstanding; earlier browser findings below are historical, not latest validation. `b5d8618` is the historical last pushed commit; latest changes are not pushed and the website is not live. GitHub Pages management authentication and one-time Settings > Pages → branch `main` → `/ (root)` setup remain pending. Publication final status will be added by the parent.
**Repository:** https://github.com/LREE333/MailStone

---

## Overview

This document records the difficulties I encountered while building MailStone, how each was resolved, and which difficulties remain open. The difficulties fall into four categories: (A) policy data collection, (B) technical design, (C) institutional communication, and (D) resources still pending.

---

## A. Policy data collection

### A1. No central exam-absence procedure

**Difficulty.** The General Academic Regulations (GAR) do not contain a standalone clause for "absence from examination." GAR 13.1 covers leave of absence exceeding 7 days, and 13.2 states that unapproved prolonged absence results in grade F, but neither describes what a student should *do* if they miss an exam.

**How I resolved it.** I recorded this as a documented gap (`GAP-EXAM-ABSENCE`) in the data rather than treating it as a search failure. The Gatekeeper routes exam-absence requests to an empty state that says "the regulations are silent on this" and offers the SEN Support Services route as a partial mitigation. The supervisor confirmed this is a genuine institutional finding, not a defect in my search.

**Status:** Resolved as a finding. The gap is itself a feature of the tool — it demonstrates that the system withholds rather than invents.

---

### A2. No "extenuating circumstances" or "special consideration" policy

**Difficulty.** Many universities have a formal "extenuating circumstances" or "special consideration" procedure that allows students to request relief after a deadline. I searched the GAR and could not find one. Special circumstances appear only as a ground for formal grade review (GAR 9.2.2(iii)) and as leave of absence (GAR 13.1).

**How I resolved it.** I asked the supervisor, who confirmed that EdUHK has no faculty-level special consideration mechanism outside the handbook. This means that after a deadline has passed, the "ask for permission in advance" route (9.6.1) is closed, and what remains is either explaining the situation to the lecturer informally or requesting a formal grade review (9.2).

**Status:** Resolved as a confirmed institutional finding.

---

### A3. EdUHK publishes separate regulations per programme type

**Difficulty.** EdUHK does not publish one set of academic regulations. It publishes at least three: (a) GAR in the Student Handbook (sub-degree, UG, PGDE), (b) GAR for Taught Postgraduate Programmes (two cohort versions: 2013/14 and before; 2014/15 and thereafter), and (c) GAR for the Research Component (RPg and professional doctorate). A clause that governs a BEd student may not govern a taught master's student, and the clause numbers may not line up.

**How I resolved it.** I modelled programme scope as a required field on every source document and every rule. The Gatekeeper checks scope *before* relevance — a rule is usable only if the student's programme level falls inside the rule's resolved scope. TPG and RPG regulations are registered as sources but marked `identified_not_retrieved`, so the Gatekeeper withholds rather than substituting undergraduate clauses.

**Status:** Scope checking is implemented for the modelled levels (sub-degree, UG, PGDE), but the GAR and Procedures source records still mark their inferred applicability `needs_confirmation`. Do not call that institutional scope verification. TPG/RPG regulations remain identified but not retrieved; the scope gap is shown in the UI rather than hidden.

---

### A4. The SEN Support Services leaflet is an image-only PDF

**Difficulty.** The SEN Support Services leaflet (the primary source for the support service route) is a PDF with no text layer. Standard text extraction returned nothing.

**How I resolved it.** I rendered the PDF pages to PNG images using `sips` (a macOS built-in tool) and read them visually. The contact details and service list were then transcribed into the data files.

**Status:** Resolved.

---

### A5. The SEN Support Services page URL redirected to the homepage

**Difficulty.** The URL `https://www.eduhk.hk/sao/en/info/sen/about_sen/` returned a 302 redirect to the SAO homepage, not the SEN page.

**How I resolved it.** I traced the navigation path from the SAO homepage and found the real path: `/sao/en/info/counselling_services/sen/`. This is now the locator recorded in the source data.

**Status:** Resolved.

---

### A6. Role addresses were absent from the collected regulations, not all official pages

**Difficulty.** After testing the prototype I wanted the result page to show the correct office or department email address so the student would not have to hunt for it. The obvious failure mode is guessing a personal address. The General Academic Regulations name roles — course lecturer, Faculty Dean, Programme Leader, Secretary of the Students' Appeal Committee — but print no address for any of them. A plausible-looking `firstname.lastname@eduhk.hk` would be a hallucination with real consequences. This original finding applied to those collected pages, not every official EdUHK site: the later LML staff page does publish individual work addresses.

**How I resolved it.** I separated a **contact directory** from a **policy source**. `data/policy/contacts.json` says WHERE to send, never WHAT the rules say. Source-backed leads must come from an official page or a document registered in `sources.json`, with `source_ids`, `source_url` and `retrieved_date`. The original University Contact Us (`EDUHK-CONTACT-US-2026`) and SAO retrieval supplied 6 office addresses. The 4 role-only rows still have `email: null` and optional lookup links; a public staff address alone does not resolve those route roles. One attempted page (`/re/About-Registry/Contact-Us.html`) returned 404, so I did not use it. The latest local `staff_directory` separately contains 18 LML name/work-email records sourced to `https://www.eduhk.hk/lml/people` (`EDUHK-LML-STAFF-2026`, 15 Nov), not a live whole-University lookup.

**Status:** Implemented locally: 10 route contacts (6 published office addresses + 4 withheld roles), 18 separate LML staff records, 24 unique published addresses, 6 route bindings and 1 historical LIN4049 → LAU association (2025-26 S2 group 31E; current teaching not confirmed). Explicit candidate selection and final student confirmation are required; manual entry/unknown fallback remains. Permission for wider reuse or a maintained public-contact feed has not been obtained (D7).

---

### A7. Wofo (卧佛) "email templates" are TOEFL exam-task samples, not academic correspondence

**Difficulty.** The user asked whether "academic email templates" from the Wofo website (wofo.cc) had been collected. Wofo is a Chinese study-abroad and TOEFL preparation platform. Its "email templates" are TOEFL "Write an Email" exam-task samples — timed (7-minute) responses to prompted scenarios, not real academic correspondence. Including them as if they were model academic emails would mislabel the corpus.

**How I resolved it.** I separated exam-task genre from academic correspondence. Actual `corpus.json` has 3 `toefl_exam_sample`-tagged records: 2 retrieved full-text samples (EX-019, EX-020) and Wofo EX-021, a metadata-only consulted-platform record. EX-021's `text` is an access note, not an email; its empty/null annotation fields are not completed email annotation. EX-019 is attributed to ETS, but the recorded full-text retrieval is from the Zhihu reprint (`source_locator`), not direct ETS retrieval. ETS is listed in `corpus.json.sources_consulted`; checking actual `data/policy/sources.json` finds no `ETS-TOEFL-2026` source. The earlier registration claim was incorrect.

**Status:** Genre separation implemented. Only 2 full-text TOEFL samples may be counted; Wofo full-text retrieval and independent primary-source provenance checking remain open. Do not count exam samples or platform metadata as real academic correspondence.

---

## B. Technical design

### B1. How to prevent AI hallucination in policy output

**Difficulty.** The original plan was to have an AI model generate emails and then verify them. The problem: a model that has absorbed "successful request" emails as training data tends to produce text that *looks* right but makes factual claims the regulations do not support — e.g., "Thank you for granting me an extension" when no extension has been granted.

**How I resolved it.** I separated the architecture into two components:
- **Gatekeeper** (deterministic, no model call): retrieves the applicable rule from the data files. Every output is traceable to a clause number and a verbatim quote.
- **Writer** (model-based, optional): generates the email text, constrained by the Gatekeeper's output.

The template-based writer is the zero-hallucination baseline. The model will be compared against this baseline, not against ungrounded generation. If the model is never integrated, the template remains a valid deliverable.

**Status:** Resolved. The template engine works; model integration is future work.

---

### B2. How to convert negative email examples into checkable rules

**Difficulty.** Collecting "bad email" examples is easy, but feeding them to a model as "avoid this" text is unreliable — LLMs handle prohibitions poorly. I needed a way to turn negative examples into something auditable and testable.

**How I resolved it.** Each negative example was converted into a deterministic check:
- **Tier 1** (lexical/structural): regex patterns and structural metrics that run in the browser with no model call. Examples: detect presumptive approval language, count apology markers, check for unresolved placeholders.
- **Tier 2** (rubric judge): a model-based rubric that must be scored against human labels. Not yet implemented.
- **Tier 3** (policy cross-check): checks that the draft does not contradict the selected policy rule. Example: if the route is closed (post-deadline), the draft must not ask for "permission in advance."

The 12 checks are in `data/quality/violations.json` and are tested in `tools/test.mjs`.

**Status:** Resolved for Tier 1. Tier 2 requires model integration and human labels.

---

### B3. The lint tool's own output had three defects

**Difficulty.** When I ran the lint tool on two real emails (the SAO enquiry and the supervisor enquiry), it produced three false results:
- **V06** missed direct questions ("Does this cover coursework deadlines?") — it only matched politeness formulas like "could you please."
- **V09** warned about missing course codes in every email sent to a faculty member or central office, even when a course code is irrelevant (e.g., writing to the Faculty Dean about a formal review).
- **V08** counted request sentences rather than distinct actions — an email with three numbered sub-questions was indistinguishable from an email with three competing requests.

**How I resolved it.**
- V06: extended the request marker patterns to include direct interrogatives.
- V09: gated the check on `recipientLevel === "course"` — it only fires when the recipient is the course lecturer.
- V08: I did **not** "fix" it. The correct fix would need request objects, not sentence counts, which is a deeper change. Instead, I stated the limitation in the violation's `implementation_note`, pinned a test that documents the limitation, and reported it in the plan. Loosening the rule to make the test pass would have hidden a real limitation.

**Status:** V06 and V09 resolved. V08 limitation is documented and accepted.

---

### B4. How to model "empty states" honestly

**Difficulty.** When the Gatekeeper cannot find a rule (because the programme is out of scope, the topic is absent from the regulations, or the student has not identified a topic), the tool needs to say something. A generic "no results found" message is unhelpful and misleading — it suggests the system is broken when in fact the system is correctly identifying a gap.

**How I resolved it.** I designed three distinct empty states, each driven by data rather than hardcoded:
- `out_of_scope` — the student's programme is not in the corpus (e.g., TPG). The message says "your programme's regulations are not in this policy base" and names the governing document.
- `no_rule` — the programme is covered but the topic is absent from the regulations (e.g., exam absence). The message says "the regulations are silent on this."
- `by_design` — the student has not identified a topic. The message says "no procedure has been identified yet."

Each state has different UI copy and different writing tips. The states are driven by `known_gaps` in `sources.json`, so adding a new gap does not require code changes.

**Status:** Resolved.

---

### B5. A course code is an identifier, not a category

**Difficulty.** A course code like `LIN4049` cannot be offered as a radio option — it is a value the student supplies, not a value the tool can infer or enumerate. I also needed a "not known yet" path, and the instruction was that the final draft should "leave it blank". Simply deleting the token would produce a subject line with an invisible hole, which is the single detail most likely to be forgotten before sending.

**How I resolved it.** I added `courseCode` as a **text step** (an input plus a "Not known yet — leave it blank" radio) to all six question sequences. The radio stores the literal string `"unknown"` rather than skipping the question, so the flow stays honest. `applyCourseCode()` runs as the last step of `buildDraft()` and replaces every `[Course code]` slot with the student's exact string — verbatim, with no normalisation or inference. For `"unknown"` it deliberately keeps the visible `[Course code]` placeholder. That placeholder is highlighted by the review preview (`.preview-placeholder`), counted in the copy prompt ("{n} placeholders still to replace") and covered by the sending checklist. V09 is designed to treat a bracketed course placeholder as "present", so it does not fire here — I corrected two code comments that had claimed otherwise.

**Status:** Resolved. One wording decision remains open (D5).

---

### B6. Three interface languages without corrupting the evidence

**Difficulty.** The interface needed English, Traditional Chinese and Simplified Chinese, but the generated email must stay uniformly English — it is the artefact being evaluated — and verbatim policy quotations must stay English because a translation is no longer verbatim and cannot be checked against a clause number. A naive "translate everything on the page" approach would silently destroy both.

**How I resolved it.** `js/i18n.js` holds a dictionary keyed by the exact (whitespace-normalised) English source string, plus a DOM text-node sweep. Two exclusions do the real work: `data-no-i18n` protects the draft textarea and the review preview, and `data-verbatim` protects quoted policy wording. Each text node stores its original English so switching back to English restores it exactly instead of translating a translation. Composite strings (counts, dates, interpolated messages) are translated at the call site with `t()` and `{n}` placeholders, because they cannot be dictionary keys. Language is held in memory, can be pinned with `?lang=`, and is never stored — the privacy promise is unchanged.

**Status:** Resolved in the second iteration (14 Nov). Historical headless-browser checks found that in `zh-Hant` and `zh-Hans` the quoted GAR 9.6.1 wording and the draft remained English. Latest intake/contact/display changes still require browser revalidation; this earlier result is not a current browser sign-off.

---

### B7. Event handlers reintroduced English text after a language switch

**Difficulty.** The sweep runs at the end of every full render, but several controls update their own labels in response to a click — the recipient confirmation checkboxes, the "Check this draft" toggle, the "Show source information" button, and the To: line status. Those assignments happened after the sweep, so in Chinese mode clicking them made English text reappear.

**How I resolved it.** I wrapped every post-render text assignment in `window.MailStoneI18n.t()` and added dictionary entries for the labels that had been missing (`Source:`, `Retrieved:`, and four recipient-level badges). In the historical second-iteration headless-browser smoke test (14 Nov), clicking the checkboxes, switching language while a recipient was confirmed and unchecking again kept the status label Chinese, the confirmed addresses in the To: line and the draft English. This records the earlier finding; browser checks of the latest local changes are still underway.

**Status:** Resolved.

---

### B8. Result page layout overflow and email buried in a two-column grid

**Difficulty.** After clicking "Check this draft", the two-column result grid caused layout overflow — fonts extended beyond the viewport. More fundamentally, the generated email — the central artefact — was squeezed into one column alongside route/policy/support information. The user's instruction was clear: "the focus should be the email generation result, displayed prominently in the centre-right; other functions should be collapsible bookmark/tab style elements."

**How I resolved it.** I replaced the two-column `.result-grid` with a single-column email-centric `.result-layout`. The generated email, lint results, self-check, and action buttons occupy the main panel. Three notebook-edge tabs (Route, Fact Lock, "Why this structure?") use vertical tabs on wide screens and horizontal tabs on narrow screens. The earlier independently toggled drawers were revised: only one drawer opens at a time, with `aria-expanded`, bounded panels, a close button and Escape; closing returns focus to its tab. The fixed viewport permits internal `.app-main` scrolling rather than page-level scrolling.

**Status:** Layout redesign and exclusive drawer controls are implemented locally. The original overflow finding is preserved; do not assert that the latest responsive/browser layout has passed. Current browser checks are underway (D6).

---

### B9. Generated emails lacked greeting and self-introduction

**Difficulty.** The user tested the tool and found the generated email unsatisfactory: "it doesn't have an opening greeting or a self-introduction. If I were a user who answered all those questions and got this result, I definitely wouldn't want to use it again." The drafts jumped straight into the context line without "Dear [Name]" or any introduction.

**How I resolved it.** I added a `relationship` step to all six question sequences with three options: "familiar" (I know them well), "taught" (normal teaching — they may not remember me), and "unknown" (I am not sure). Two helper functions were added: `getSelfIntroduction()` returns an empty string for "familiar" and a full intro ("I am [Your name], a student in your [Course code] class.") for the other two; `getOpeningLine()` combines the self-introduction with the context line in the correct order. All three draft builders (standard, post-deadline, general) were rewritten to produce: Subject → "Dear [Recipient title and surname]," → optional self-introduction + context line → reason → request → closing → "Kind regards, [Your name] [Student ID]".

**Status:** Resolved. All drafts now have proper salutation, self-introduction (where appropriate), and closing.

---

### B10. Feedback was clipboard-only; user wanted backend send

**Difficulty.** The Pebble mascot's feedback feature originally copied a feedback message to the clipboard for the user to paste into an email to the supervisor. The user wanted feedback sent directly to the backend: "I want users' feedback during use to be sent directly to our backend so we can improve the tool."

**How I resolved it.** I implemented a configurable frontend: it attempts to POST a JSON payload (`{ text, timestamp, page }`) to `window.MAILSTONE_FEEDBACK_URL` when an endpoint is configured. No configured endpoint, a failed request or a non-success response falls back to clipboard copying; if clipboard access fails, manual-copy guidance is shown. The earlier UI wording about feedback being "sent directly" and "never lost" described an intention, not verified delivery or a guaranteed clipboard result.

**Status:** Configurable POST frontend and clipboard/manual-copy fallback implemented. No deployed backend, persistent storage or successful end-to-end receipt has been verified. Static/stub tests are not backend evidence.

---

### B11. Role-only contacts pointed at a generic Registry URL

**Difficulty.** The four role-only contacts (course lecturer, Faculty Dean, Programme Leader, SAppC Secretary) had `lookup_url` set to `https://www.eduhk.hk/re/` — the Registry homepage. This was too vague; the student would have to navigate the Registry site to find the right person. There was no registered source for the staff directory itself.

**How I resolved it.** I registered the EdUHK staff directory (`https://www.eduhk.hk/en/directory`) as `EDUHK-STAFF-DIRECTORY-2026` in `sources.json`, with `verification_status: "verified_primary"`. All four role-only contacts now cite this source in their `source_ids` and point their `lookup_url` at the staff directory. The `lookup_note` text was updated to reference the staff directory specifically.

**Status:** Directory source and role-only lookup links updated. This is an optional manual lookup page, not a readable cross-origin JSON API used by MailStone. On-page matching is limited to the separate local 18-person LML snapshot; committee/route-role destinations are still unresolved (B13).

---

### B12. TOEFL "Write an Email" as a distinct corpus genre

**Difficulty.** The user asked whether Wofo (卧佛) email templates had been collected. Wofo is a TOEFL preparation platform; its "email templates" are TOEFL exam-task samples — timed responses to prompted scenarios in a semi-formal register. Including them as `public_model` exemplars would mislabel them as model academic correspondence.

**How I resolved it.** I added `origin_class: "toefl_exam_sample"` to distinguish the exam genre, retaining the pedagogical comparison finding. The earlier "three collected samples / ETS source registered" description was inaccurate: actual records contain 2 retrieved full-text answers (EX-019, EX-020) and 1 metadata-only Wofo platform record (EX-021). EX-019's ETS attribution and official URL are recorded, but full text came through the Zhihu `source_locator`. A check of all 14 actual `sources.json` entries finds no ETS/TOEFL source ID, including `ETS-TOEFL-2026`; ETS appears only in `corpus.json.sources_consulted`.

**Status:** Distinct genre implemented, with 2 full-text exam samples, not 3 annotated emails. Wofo full-text access and independent comparison against ETS primary material remain pending. The 21 records comprise 18 academic (13 public + 5 synthetic, including negative EX-018), 2 full-text TOEFL and 1 Wofo metadata record; 0 are double-coded.

---

### B13. Teacher matching must not become an invented or current-teaching claim

**Difficulty.** A course code or partial teacher name is insufficient to infer an address or establish who currently teaches the student's course. The registered University directory is not a readable cross-origin JSON API; sending students there as a compulsory step also interrupts the writing flow.

**How I resolved it.** On-page matching uses only `contacts.json.staff_directory`: 18 public LML work contacts from `https://www.eduhk.hk/lml/people`, retrieved 2026-11-15 and attributed to `EDUHK-LML-STAFF-2026`. The sole separately sourced course association is LIN4049 → LAU, **2025-26 S2 group 31E** (`EDUHK-LIN4049-2025-26`), with `current_teaching_confirmed: false`. It can rank a candidate when the name is absent or consistent, never replace a conflicting name. Students must explicitly select a candidate or supply their own university email; unknown/unmatched cases retain a manual/unknown fallback. Final confirmation is still required before the address enters To:. Course/name/email edits revoke stale teacher confirmation; programme/request/timing changes clear route confirmations.

**Status:** Local matching and confirmation safeguards implemented; neither whole-University coverage, live freshness nor current teaching is confirmed. Wider feed permission remains pending (D7).

---

### B14. Intake order and Fact Lock contradicted supplied code/date facts

**Difficulty.** The old flow did not establish programme scope first or immediately ask for dates after a time-related request. Fact Lock could still list a supplied course code as missing and a selected preferred deadline as an unresolved duration.

**How I resolved it.** Every flow now begins programme → request. Extension, absence, exam, grade and review immediately ask for two request-specific dates using explicit Year/Month/Day native `<select size="5">` lists; `unsure` omits irrelevant dates. "Choose a date" opens the lists, "Use this date" saves the selection, and "Leave this date undecided" records an unknown rather than silently accepting the initial displayed date. Calendar validity and extension/absence ordering are checked. Fact Lock separates supplied course/name/email, selected dates, unresolved fields and approval: a provided course code no longer appears as missing, and a preferred new deadline no longer retains the obsolete missing-duration message. "Provided by you / selected by you" identifies provenance, not official verification; "Not yet approved" and unconfirmed supporting documents remain explicit. Preferred dates do not replace the formal 14-working-day review window.

**Status:** Code/date display bug fixed locally, with regression assertions for supplied code and preferred deadline. The reported current suite is 214 passed, 0 failed; source/stub checks are not the latest browser validation (D6).

---

### B15. Display controls and reference drawers needed a consistent state

**Difficulty.** The result page needed readable dark-mode styling and reference tabs that did not open overlapping drawers.

**How I resolved it.** Pebble → Display → Dark mode toggles the display with pressed-state feedback. Colored notebook tabs use exclusive drawers: opening one closes another; clicking the active tab, its close button or Escape closes it, with focus returned to the relevant tab.

**Status:** Dark mode and exclusive notebook tabs implemented locally. Latest light/dark, focus, Chinese-interface and responsive browser checks are underway, not signed off.

---

## C. Institutional communication

### C1. Identifying the AI-tool procedure

**Difficulty.** The supervisor's timeline email referred to "the established procedure (attached)" for AI tool use. The attachment was a reimbursement form, not an AI procedure document. I initially could not find a separate AI-procedure document anywhere.

**How I resolved it.** I asked the supervisor directly. The supervisor confirmed that under the reimbursement scheme framework, this pre-approval constitutes the *complete* procedural requirement for AI tool use in the capstone project. No separate LTTC application or external-API approval process is required. The reimbursement scheme IS the procedure.

**Status:** Resolved (8 Nov 2026).

---

### C2. Identifying the approved LLM service

**Difficulty.** I needed to know whether EdUHK provides an approved LLM service that students can use without purchasing an external API subscription, and if so, how to access it.

**How I resolved it.** The supervisor confirmed that LTTC provides LLM Studio (front-end) backed by a MaaS (Model-as-a-Service) platform. Students access it primarily through workshops explicitly aimed at them and credit-bearing courses, not through a public no-registration chat interface.

**Status:** Resolved as identification. The decision of whether to use LTTC or request reimbursement for an external API is pending (by 30 Nov 2026).

---

### C3. SAO did not answer my specific questions

**Difficulty.** I sent a carefully structured email to SAO (saosen@eduhk.hk) asking three specific questions about Academic Accommodation: (1) does it cover coursework deadlines, (2) are TPG students eligible, (3) can it be arranged after a deadline. SAO replied with a one-line redirect to their website.

**How I resolved it.** I retrieved the web page they linked to (`https://www.eduhk.hk/sao/en/info/counselling_services/sen/support_service`) and found that it contained far more detail than the leaflet. It explicitly lists "Extension of assignment deadlines" under Lecture/Assignment Arrangements — resolving the most important question. It also states that accommodations require "sufficient information (including but not limited to medical reports)," which resolves the registration question. The third question (retrospective application after a deadline) is not answered on the page and remains open.

**Status:** The deadline-extension listing and request/supporting-information pathway are established. The earlier "two of three questions resolved" shorthand must not be treated as explicit TPG eligibility confirmation: the page has no programme restriction, but its source scope still says `needs_confirmation`. Retrospective availability is also still open; the tool states it as "Not established" and advises the student to ask.

---

### C4. The SEN leaflet did not describe what "Academic Accommodation" covers

**Difficulty.** The SEN Support Services leaflet lists "Academic Accommodation" as a service but does not state what it covers, who is eligible, whether registration is required, or whether it can be applied retrospectively. These four questions were the biggest open items in the project.

**How I resolved it.** C3's retrieved SAO page establishes the accommodation listing and request/supporting-information pathway. The SAO reply is registered as the retrieval trigger, not additional policy content. Retrospective application remains open; programme eligibility is not explicitly confirmed beyond the page's general wording.

**Status:** Partially resolved. "Confirmed" UI rows describe the established service findings, not approval of an individual request or explicit TPG eligibility; retrospective availability remains "Not established".

---

## D. Resources still pending

### D1. TPG and RPG regulations not collected

**What it is.** The General Academic Regulations for Taught Postgraduate Programmes (two cohort versions) and the GAR for the Research Component are registered as sources but not retrieved. The Gatekeeper withholds rather than substituting.

**Why it is not resolved.** Collecting these would require navigating the Graduate School pages, which returned a TLS error on 31 Oct 2026. The scope gap is itself a feature the tool demonstrates — it shows that the system knows what it does not know.

**Plan:** Retrieve before the final report if possible. If not, report as a known limitation.

---

### D2. Model integration not yet implemented

**What it is.** The current writer is template-based. The model-based writer (using LTTC's LLM Studio or an external API via reimbursement) is planned but not yet integrated.

**Why it is not resolved.** Access to LTTC's LLM Studio requires attending a workshop or enrolling in a credit-bearing course. The reimbursement scheme requires pre-approval by 30 Nov 2026. The decision of which path to take has not yet been made.

**Plan:** Decide by 30 Nov. If neither path is available in time, the template engine is the deliverable and the model becomes future work. This is an acceptable outcome — the template is the zero-hallucination baseline.

---

### D3. Corpus double-coding not yet done

**What it is.** 18 academic exemplars have first-pass author annotations (13 public + 5 synthetic, including the negative EX-018). EX-019/EX-020 also carry exam-genre annotations; Wofo EX-021 is only metadata with empty/null annotation fields. These are not 21 completed academic annotations. The corpus records 0 double-coded items; inter-rater reliability (Cohen's kappa) requires a second coder.

**Why it is not resolved.** The second coder has not been arranged yet.

**Plan:** Arrange double coding for at least 50 items before the evaluation phase. Report kappa per violation category. A category with kappa below 0.6 will be redefined or dropped.

---

### D4. Whether SAO accommodation can be arranged after a deadline

**What it is.** The SAO web page lists "Extension of assignment deadlines" as a possible accommodation but does not state whether requests can be made retrospectively.

**Why it is not resolved.** SAO did not answer this question directly. The web page does not address it.

**Plan:** A follow-up email asking only this question, if the answer is needed for the report. For now, the tool states it as "Not established" and advises the student to ask SAO directly.

---

### D5. What "leave it blank" should look like in the final draft

**What it is.** The instruction for a course code that is "not known yet" was that the generated email should leave it blank. I implemented this as a **visible** `[Course code]` placeholder rather than an empty string, because an invisible gap in a subject line is easy to overlook, whereas a highlighted bracketed token is caught by the review preview, the copy prompt and the sending checklist.

**Why it is not resolved.** "Leave it blank" could reasonably mean either (a) an empty string, or (b) a visible unfilled field. The two behave differently: an empty string would trigger V09 ("No course code found"), while a visible placeholder is treated as "present" by V09 but still flagged as something to replace. I chose (b) and documented the reasoning in the code, but the wording decision has not been confirmed with the supervisor or the intended student users.

**Plan:** Confirm the preferred behaviour in the next supervisor meeting. If an empty string is preferred, the change is one line in `applyCourseCode()`, but the V09 gating and the sending-checklist wording would then need to be reviewed together.

---

### D6. Latest browser validation and publication are not complete

**What it is.** The local suite reports 202 passing assertions, but some UI tests inspect source or use stubs. Historical second-iteration headless-browser results remain useful findings, not proof of the latest intake/contact/display flow.

**Why it is not resolved.** Actual latest browser checks are underway. `b5d8618` is the historical last pushed commit; latest changes are unpushed. GitHub Pages is not live, management authentication is missing and one-time branch `main` / `/ (root)` setup remains pending.

**Plan:** Finish browser checks before reporting current validation. The parent handles authentication, push, Pages setup and verified publication status later; this documentation task performs none of them. Keep frontend feedback implementation separate from unverified backend deployment/delivery.

---

### D7. Permission and maintenance for a wider contact feed

**What it is.** The 18-person LML snapshot contains attributed public name/work-email facts, not biographies, private contacts or a whole-University live feed. Its source retrieval date does not establish current teaching, role assignment or freshness on the day of sending.

**Why it is not resolved.** Institutional permission for wider contact reuse or a maintained feed has not been obtained. Public availability alone is not permission for expanded reuse; the historical LIN4049 listing does not fill that gap.

**Plan:** Keep the narrow snapshot and explicit selection/final confirmation boundary. Obtain the relevant permission and agree coverage, update cadence and correction handling before expanding or maintaining a wider feed. Do not imply that this permission is already granted.

---

## Summary table

| # | Difficulty | Category | Status |
|---|---|---|---|
| A1 | No central exam-absence procedure | Policy | Resolved as finding |
| A2 | No extenuating circumstances policy | Policy | Resolved (supervisor confirmed) |
| A3 | Separate regulations per programme type | Policy | Scope checking implemented; inferred handbook scope unconfirmed; TPG/RPG not retrieved |
| A4 | SEN leaflet is image-only PDF | Technical | Resolved |
| A5 | SEN page URL redirected | Technical | Resolved |
| A6 | Collected regulations lack role addresses; LML publishes individual work emails | Policy | 10 route contacts (6 office + 4 withheld), 18 LML staff, 24 unique addresses; selection/confirmation required |
| A7 | Wofo templates belong to the TOEFL exam genre | Corpus | 2 full-text TOEFL samples + 1 metadata-only Wofo record; primary provenance checks pending |
| B1 | AI hallucination risk | Design | Resolved (deterministic Gatekeeper + template baseline) |
| B2 | Converting negative examples to checks | Design | Resolved for Tier 1 |
| B3 | Three lint defects found by using the tool | Technical | V06/V09 resolved; V08 documented |
| B4 | Honest empty states | Design | Resolved |
| B5 | Course code is an identifier, not a category | Design | Resolved (text step + verbatim substitution) |
| B6 | Three languages without corrupting the evidence | Design | Resolved (sweep + exclusions) |
| B7 | Event handlers reintroduced English after a switch | Technical | Resolved (t() at every post-render assignment) |
| B8 | Result page layout overflow and email buried | Design | Email-centric layout and exclusive drawers implemented; latest browser/layout checks underway |
| B9 | Drafts lacked greeting and self-introduction | Design | Resolved (relationship step + helper functions) |
| B10 | Feedback was clipboard-only | Design | Configurable POST frontend + clipboard/manual fallback; deployed backend/delivery unverified |
| B11 | Role-only contacts pointed at generic Registry URL | Technical | Resolved (staff directory registered + contacts updated) |
| B12 | Wofo/TOEFL templates are not academic correspondence | Design | Genre separated; ETS consulted in corpus, not registered in policy sources |
| B13 | Teacher matching could imply an invented/current destination | Design | Local 18-person snapshot; LIN4049 historical 2025-26 S2 group 31E only; no guesses |
| B14 | Intake order and Fact Lock code/date contradiction | Technical | Programme → request → immediate dates; supplied-code/preferred-date display bug fixed locally |
| B15 | Dark-mode display and overlapping reference drawers | Design | Dark mode and exclusive notebook tabs implemented; browser checks underway |
| C1 | Identifying AI-tool procedure | Communication | Resolved (8 Nov) |
| C2 | Identifying approved LLM service | Communication | Resolved (8 Nov) |
| C3 | SAO did not answer specific questions | Communication | Service/request findings established (9 Nov); explicit TPG eligibility and retrospective availability unconfirmed |
| C4 | SEN leaflet lacked service scope detail | Communication | Partially resolved (9 Nov) |
| D1 | TPG/RPG regulations not collected | Pending | Future work |
| D2 | Model integration not implemented | Pending | Decision by 30 Nov |
| D3 | Corpus double-coding not done | Pending | Evaluation phase |
| D4 | Retrospective SAO accommodation | Pending | Follow-up if needed |
| D5 | "Leave it blank" = empty string or visible placeholder? | Wording | Implemented as visible placeholder; confirm at next meeting |
| D6 | Latest browser validation and publication | Pending | 214 automated assertions pass; browser checks underway; unpushed/not live; Pages auth missing |
| D7 | Wider public-contact feed permission/maintenance | Pending | Permission not obtained; narrow snapshot and current-teaching limits retained |
