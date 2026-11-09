# Email drafts — status and context

## Overview

Two communications were planned:

1. **To Bibi (bkyleung@eduhk.hk)** — asking three questions about the AI-tool procedure
2. **To SAO (saosen@eduhk.hk)** — asking whether Academic Accommodation covers coursework deadlines and TPG students

## 1. Bibi — AI procedure questions: ANSWERED

**Status:** All three questions answered on 2026-11-08. No email needs to be sent.

The supervisor provided the following answers:

### Q1: Is supervisor pre-approval the whole procedure?

**Yes.** Under the reimbursement scheme framework, the supervisor's pre-approval constitutes the complete procedural requirement for using AI tools in the capstone project. No separate application or approval process is required beyond this pre-approval.

The two documents that establish this:
- Guideline for Student Reimbursement (dated 9 Sep 2026)
- Revised Application for Student Reimbursement (dated 16 Jan 2026)

These are now registered as source `EDUHK-REIMBURSEMENT-2026` in `data/policy/sources.json`.

### Q2: Does LTTC provide an approved LLM service?

**Yes, but access is structured.** LTTC provides LLM Studio (front-end) backed by a MaaS (Model-as-a-Service) platform. Students access it primarily through:
- Workshops explicitly aimed at students
- Credit-bearing courses that incorporate the tool

It is not a public, no-registration chat interface. This is now registered as source `EDUHK-LTTC-LLM-STUDIO` in `data/policy/sources.json`.

### Q3: Can the project proceed without purchasing an external API?

**Yes.** If LTTC's LLM Studio is sufficient, no purchase is needed. If an external API is needed, the reimbursement scheme covers up to HK$5,000, but only if the tool is not available from LTTC. Pre-approval by 30 Nov 2026.

### What was NOT asked

The user did not need to send the Bibi email because the supervisor provided all three answers directly in conversation. The email draft that was prepared is no longer needed.

---

## 2. SAO — Academic Accommodation scope questions: REPLIED (partially resolved)

**Status:** Email sent 9 Nov 2026. SAO replied same day with a redirect to their web page. Two of three questions resolved. One remains open.

### What happened

1. The project sent the email below to saosen@eduhk.hk asking three questions.
2. SAO replied: "Thank you for your enquiry. For more details of our services scope, please refer to our website below." with a link to https://www.eduhk.hk/sao/en/info/counselling_services/sen/support_service
3. The web page was retrieved and found to contain far more detail than the leaflet. It explicitly lists **"Extension of assignment deadlines"** under Lecture/Assignment Arrangements.

### What was resolved

| Question | Status | Answer |
|---|---|---|
| Does Academic Accommodation cover coursework deadlines? | **Resolved** | Yes — "Extension of assignment deadlines" is listed under Lecture/Assignment Arrangements |
| Are TPG/RPG students eligible? | **Resolved** | The page addresses "students with Disabilities or SEN" without programme restriction |
| Is registration required? | **Resolved** | Accommodations are provided "Upon requests and provision of sufficient information (including but not limited to medical reports)" |
| Can it be arranged after a deadline? | **Still open** | The page does not state this. SAO did not answer directly. |

### Sources registered

- `EDUHK-SAO-SEN-WEB-2026` — the support service web page (verified_primary)
- `EDUHK-SAO-REPLY-2026-11-09` — the SAO reply email (corroboration)
- Updated `EDUHK-SAO-SEN-LEAFLET` notes to cross-reference the web page

### Impact on the project

This is the most significant finding since the AI-procedure resolution. The post-deadline extension state previously said "the route through the lecturer is closed, and the SEN service exists but we don't know what it covers." Now we know it covers assignment deadline extensions. The support panel in the UI now shows this as a "Confirmed" finding rather than "Not established."

The one remaining open question — whether the accommodation can be arranged retrospectively — stays as "Not established" in the UI. If a follow-up email is needed, it should ask only this question.

### Original email (sent)

```
To: saosen@eduhk.hk
Subject: Question about Academic Accommodation — SEN Support Services

Dear SEN Support Services team,

I am an undergraduate student at EdUHK, and I am developing a tool to help
students write clearer academic emails as part of my capstone project
(LIN4049). I am writing to ask about the scope of the Academic Accommodation
service listed on the SEN Support Services leaflet.

I have read the leaflet which lists Academic Accommodation among the services
your office provides, alongside Special Examination Arrangements, Counselling
Service, and others. The leaflet does not describe what Academic Accommodation
covers, so I would like to ask:

1. Does Academic Accommodation cover adjustments to coursework deadlines
   (for example, an extended submission date for an assignment), or is it
   limited to examination arrangements?

2. Are taught postgraduate and research postgraduate students eligible for
   Academic Accommodation, or is the service for undergraduate and sub-degree
   students only?

3. If a student is not yet registered with your office, can they still make
   an enquiry about what accommodation might be available?

I am not asking you to confirm an outcome for any particular case. I am asking
about the scope of the service so that the tool I am building can direct
students to the right office and describe it accurately.

Thank you for your time.

Kind regards,
LI Leer
Student ID: 11601718
```

### Why each paragraph exists

- **Paragraph 1:** Identifies the writer and the purpose. The capstone-project context explains why a student is asking about service scope rather than requesting accommodation.
- **Question 1:** The leaflet lists Academic Accommodation and Special Examination Arrangements as separate items. Whether "Academic Accommodation" includes coursework deadlines is the most important open question for the tool — if it does, the post-deadline extension state gains a route that is currently missing.
- **Question 2:** The programme scope of the service is ambiguous. The government directory (EDB) lists degree/sub-degree/certificate; the University's own leaflet does not restrict. SAO can settle this.
- **Question 3:** This determines whether the tool's "ask them directly" copy is accurate. If registration is a prerequisite for any enquiry, the copy needs to change.
- **Disclaimer sentence:** Prevents the email from being read as a request for a specific accommodation, which SAO would have to process rather than answer.

### What to do with the reply

The reply has been received and processed. Two of three questions resolved:

**Already done:**
- ✅ Removed the "Not established" label for the coverage question in `rules.eduhk.json` → `support_services[0].open_questions`
- ✅ Added `resolved_questions` array with the findings and their source
- ✅ Updated §2.2 of the plan with the SAO findings
- ✅ Updated the support panel in `app.js` to show "Confirmed" rows alongside "Not established"
- ✅ Updated `GAP-EXTENUATING-CIRCUMSTANCES` with the supplementary finding

**Still to do (if needed):**
- If a follow-up to SAO is desired, ask only: "Can an accommodation be arranged after a deadline has passed?"
- The retrospective question is the sole remaining open item
