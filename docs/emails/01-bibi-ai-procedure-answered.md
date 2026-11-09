# Bibi AI-procedure questions — ANSWERED (2026-11-08)

This file records the three questions that were prepared for the supervisor
(Bibi Leung, bkyleung@eduhk.hk) about the AI-tool procedure, and the answers
received. The email was not sent because the supervisor provided the answers
directly in conversation.

## Questions and answers

### Q1: Is supervisor pre-approval the whole procedure?

**Planned email text:**
> I already have the Guideline for Student Reimbursement (dated 9 Sep 2026)
> and the Revised Application for Student Reimbursement (dated 16 Jan 2026).
> Could you confirm whether the supervisor's pre-approval under this scheme
> is the complete procedure for using AI tools in the capstone project, or
> whether there is a separate approval I need to obtain?

**Answer received (2026-11-08):**
Under the reimbursement scheme framework, the supervisor's pre-approval
constitutes the complete procedural requirement for using AI tools in the
capstone project. No separate approval process is required beyond this
pre-approval.

### Q2: Does LTTC provide an approved LLM service?

**Planned email text:**
> Before I consider an external API subscription, I want to check whether
> the University provides an approved LLM service through LTTC. If such a
> service exists, I would prefer to use it. I have not purchased anything,
> and I will not do so before approval.

**Answer received (2026-11-08):**
EdUHK LTTC provides LLM Studio (front-end) backed by a MaaS (Model-as-a-
Service) platform. Students access it primarily through workshops explicitly
aimed at them and credit-bearing courses that incorporate the tool. It is not
a public, no-registration chat interface.

### Q3: Can the project proceed without purchasing anything?

**Planned email text (implicit in Q2):**
> I have not purchased anything, and I will not do so before approval.

**Answer received (2026-11-08):**
Yes. If LTTC's LLM Studio is sufficient, no purchase is needed. If an external
API is needed, the reimbursement scheme covers it up to HK$5,000, but only if
the tool is not available from LTTC. The supervisor note on the guideline
states: "approved only if they are not available from LTTC or the course-
offering department."

## Sources registered

These answers are recorded in `data/policy/sources.json` as:
- `EDUHK-REIMBURSEMENT-2026` — the reimbursement scheme documents
- `EDUHK-LTTC-LLM-STUDIO` — the LTTC LLM service description

The previously open funding gate is recorded as resolved gap `GAP-AI-TOOL-PROCEDURE`
in `sources.json` → `known_gaps`.

## What this means for the project

1. The project may proceed with AI integration under the supervisor's pre-approval.
2. The access model for LTTC's LLM Studio (workshops/courses) must be accounted for.
3. The template-based baseline remains the zero-hallucination control condition.
4. The funding decision (LTTC vs. reimbursement) must be made by 30 Nov 2026.
