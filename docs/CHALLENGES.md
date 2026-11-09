# MailStone — Difficulties Encountered and How They Were Resolved

**Student:** LI Leer (11601718)
**Course:** LIN4049, EdUHK
**Date:** 9 November 2026

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

**Status:** Resolved for the covered levels (sub-degree, UG, PGDE). The TPG and RPG regulations are deliberately not collected — the scope gap is shown in the UI as a feature, not hidden as a failure.

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

**Difficulty.** When I ran the lint tool on two real emails (the SAO enquiry and the Bibi enquiry), it produced three false results:
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

## C. Institutional communication

### C1. Identifying the AI-tool procedure

**Difficulty.** The supervisor's timeline email referred to "the established procedure (attached)" for AI tool use. The attachment was a reimbursement form, not an AI procedure document. I initially could not find a separate AI-procedure document anywhere.

**How I resolved it.** I asked the supervisor directly. She confirmed that under the reimbursement scheme framework, her pre-approval constitutes the *complete* procedural requirement for AI tool use in the capstone project. No separate LTTC application or external-API approval process is required. The reimbursement scheme IS the procedure.

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

**Status:** Two of three questions resolved. The third (retrospective application) is still open but is not blocking — the tool states it as "Not established" and advises the student to ask.

---

### C4. The SEN leaflet did not describe what "Academic Accommodation" covers

**Difficulty.** The SEN Support Services leaflet lists "Academic Accommodation" as a service but does not state what it covers, who is eligible, whether registration is required, or whether it can be applied retrospectively. These four questions were the biggest open items in the project.

**How I resolved it.** This was resolved by C3 above — the SAO web page answered two of the four questions, and the SAO reply email is registered as a source that triggered the retrieval. The remaining question (retrospective application) is documented as an open item in the data.

**Status:** Partially resolved. The "Not established" label in the UI has been replaced with "Confirmed" rows showing the resolved findings.

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

**What it is.** 18 exemplars have been annotated in a first pass by the author. Double coding (for inter-rater reliability, Cohen's kappa) requires a second coder.

**Why it is not resolved.** The second coder has not been arranged yet.

**Plan:** Arrange double coding for at least 50 items before the evaluation phase. Report kappa per violation category. A category with kappa below 0.6 will be redefined or dropped.

---

### D4. Whether SAO accommodation can be arranged after a deadline

**What it is.** The SAO web page lists "Extension of assignment deadlines" as a possible accommodation but does not state whether requests can be made retrospectively.

**Why it is not resolved.** SAO did not answer this question directly. The web page does not address it.

**Plan:** A follow-up email asking only this question, if the answer is needed for the report. For now, the tool states it as "Not established" and advises the student to ask SAO directly.

---

## Summary table

| # | Difficulty | Category | Status |
|---|---|---|---|
| A1 | No central exam-absence procedure | Policy | Resolved as finding |
| A2 | No extenuating circumstances policy | Policy | Resolved (supervisor confirmed) |
| A3 | Separate regulations per programme type | Policy | Resolved for UG/PGDE; TPG/RPG pending |
| A4 | SEN leaflet is image-only PDF | Technical | Resolved |
| A5 | SEN page URL redirected | Technical | Resolved |
| B1 | AI hallucination risk | Design | Resolved (deterministic Gatekeeper + template baseline) |
| B2 | Converting negative examples to checks | Design | Resolved for Tier 1 |
| B3 | Three lint defects found by using the tool | Technical | V06/V09 resolved; V08 documented |
| B4 | Honest empty states | Design | Resolved |
| C1 | Identifying AI-tool procedure | Communication | Resolved (8 Nov) |
| C2 | Identifying approved LLM service | Communication | Resolved (8 Nov) |
| C3 | SAO did not answer specific questions | Communication | 2 of 3 resolved (9 Nov) |
| C4 | SEN leaflet lacked service scope detail | Communication | Partially resolved (9 Nov) |
| D1 | TPG/RPG regulations not collected | Pending | Future work |
| D2 | Model integration not implemented | Pending | Decision by 30 Nov |
| D3 | Corpus double-coding not done | Pending | Evaluation phase |
| D4 | Retrospective SAO accommodation | Pending | Follow-up if needed |
