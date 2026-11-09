"use strict";

/*
  MailStone MVP

  This prototype:
  - does not send email;
  - does not save user answers;
  - does not call an AI service yet (the writer is template-based, which is
    the zero-hallucination baseline the model will later be compared against);
  - does not guess personal university email addresses;
  - does not claim that a request has been approved.

  Policy text is NOT hard-coded here. It is loaded from
  data/policy/rules.eduhk.json so that every sentence shown to a student can
  be traced to a clause number and a source URL.

  Requires a local web server (VS Code Live Server) because the browser will
  not fetch JSON from a file:// page.
*/

const SEQUENCES = {
  extension: [
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "reason",
    "disclosure",
    "time",
    "tone"
  ],
  absence: [
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "reason",
    "disclosure",
    "tone"
  ],
  exam: [
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "reason",
    "disclosure",
    "tone"
  ],
  grade: ["programme", "requestType", "timing", "goal", "situation", "tone"],
  review: ["programme", "requestType", "timing", "goal", "situation", "tone"],
  unsure: ["programme", "requestType", "goal", "situation", "tone"]
};

const CAPTIONS = {
  programme: "Which regulations apply",
  requestType: "Let's begin",
  timing: "Checking the timing",
  goal: "Choosing a direction",
  situation: "Understanding your situation",
  reason: "Choosing what to share",
  disclosure: "Choosing disclosure",
  time: "Planning the request",
  tone: "Choosing a tone"
};

const STEP_DEFS = {
  /*
    Asked first, because applicability is decided before relevance. EdUHK
    publishes separate regulations per programme type, so the Gatekeeper
    cannot honestly quote a clause until it knows which document governs
    this student.
  */
  programme: {
    id: "programme",
    tag: "WHICH RULES APPLY",
    title: "Which programme are you studying?",
    hint:
      "EdUHK publishes different academic regulations for different programme types. This decides which set of rules can be quoted to you.",
    options: [
      {
        value: "sub_degree",
        title: "Sub-degree",
        detail: "Associate degree or higher diploma."
      },
      {
        value: "ug",
        title: "Bachelor's degree",
        detail: "BEd, BA, BSc, BSocSc and similar."
      },
      {
        value: "pgde",
        title: "PGDE",
        detail: "Postgraduate Diploma in Education."
      },
      {
        value: "tpg",
        title: "Taught master's",
        detail: "A taught postgraduate degree."
      },
      {
        value: "rpg",
        title: "Research degree or doctorate",
        detail: "MPhil, PhD or EdD."
      }
    ]
  },

  requestType: {
    id: "requestType",
    tag: "REQUEST NAVIGATION",
    title: "What are you trying to resolve?",
    hint: "You do not need to know the correct procedure yet.",
    options: [
      {
        value: "extension",
        title: "Ask for more time",
        detail: "For an assignment or coursework deadline."
      },
      {
        value: "grade",
        title: "Ask about a grade or feedback",
        detail: "Understand feedback, marks or a possible error."
      },
      {
        value: "exam",
        title: "Report a missed or upcoming exam",
        detail: "Find out what to do next."
      },
      {
        value: "absence",
        title: "Report an absence",
        detail: "Explain that you cannot attend."
      },
      {
        value: "review",
        title: "Ask about a review or appeal",
        detail: "Find the formal process before writing."
      },
      {
        value: "unsure",
        title: "I am not sure",
        detail: "Help me decide what to do first."
      }
    ]
  },

  timing: {
    id: "timing",
    tag: "TIMING",
    variants: {
      extension: {
        title: "Has the deadline passed?",
        hint:
          "This changes the answer completely, so it is worth being sure.",
        options: [
          {
            value: "before_deadline",
            title: "No — I still have time",
            detail: "The due date has not arrived yet."
          },
          {
            value: "after_deadline",
            title: "Yes — it has already passed",
            detail: "The due date has gone by."
          },
          {
            value: "unknown",
            title: "I am not sure",
            detail: "I would need to check the course outline."
          }
        ]
      },

      absence: {
        title: "When is the absence?",
        hint: "Applying before it happens is a different procedure from reporting it after.",
        options: [
          {
            value: "before_deadline",
            title: "It has not happened yet",
            detail: "The class or activity is still ahead."
          },
          {
            value: "after_deadline",
            title: "It is happening now, or has passed",
            detail: "I am already absent, or was."
          },
          {
            value: "unknown",
            title: "I am not sure",
            detail: "The dates are not clear to me yet."
          }
        ]
      },

      grade: {
        title: "When did you receive the result?",
        hint:
          "A formal review has a 14 working day window, so the date matters.",
        options: [
          {
            value: "before_deadline",
            title: "Within the last two weeks",
            detail: "The result is recent."
          },
          {
            value: "after_deadline",
            title: "More than two weeks ago",
            detail: "Some time has passed."
          },
          {
            value: "unknown",
            title: "I am not sure",
            detail: "I would need to check when it was released."
          }
        ]
      },

      review: {
        title: "Has a formal decision been issued?",
        hint: "An appeal is against a decision. Without one, there is nothing to appeal yet.",
        options: [
          {
            value: "before_deadline",
            title: "No decision yet",
            detail: "I am still waiting, or the matter is unresolved."
          },
          {
            value: "after_deadline",
            title: "Yes, a decision has been made",
            detail: "I have been notified of an outcome."
          },
          {
            value: "unknown",
            title: "I am not sure",
            detail: "I do not know whether this counts as a decision."
          }
        ]
      },

      exam: {
        title: "When is the examination?",
        hint: "An examination that has not happened yet and one that has been missed are handled differently.",
        options: [
          {
            value: "before_deadline",
            title: "It has not happened yet",
            detail: "The examination is still ahead."
          },
          {
            value: "after_deadline",
            title: "I have already missed it",
            detail: "The examination date has passed."
          },
          {
            value: "unknown",
            title: "I am not sure",
            detail: "I need to check the timetable."
          }
        ]
      }
    }
  },

  goal: {
    id: "goal",
    tag: "YOUR GOAL",
    title: "What would you like to achieve first?",
    hint: "This helps us suggest the right next step.",
    options: [
      {
        value: "understand",
        title: "Understand the situation",
        detail: "Ask for clarification or feedback."
      },
      {
        value: "request",
        title: "Make a specific request",
        detail: "Ask for an extension, meeting or action."
      },
      {
        value: "procedure",
        title: "Find the formal procedure",
        detail: "Check whether a form or application is needed."
      },
      {
        value: "unsure",
        title: "I am not sure yet",
        detail: "Start with a general enquiry."
      }
    ]
  },

  situation: {
    id: "situation",
    tag: "YOUR SITUATION",
    title: "Where are you with your request?",
    hint: "This helps distinguish a new request from a follow-up.",
    options: [
      {
        value: "new",
        title: "I am making a new request",
        detail: "This is my first message about this matter."
      },
      {
        value: "followup",
        title: "I am waiting for a reply",
        detail: "I have already contacted someone."
      }
    ]
  },

  reason: {
    id: "reason",
    tag: "WHAT TO SHARE",
    title: "What would you like to share?",
    hint: "Choose only what is true. You do not need to share sensitive details.",
    options: [
      {
        value: "health",
        title: "A health-related issue",
        detail: "Keep the explanation general."
      },
      {
        value: "personal",
        title: "Personal circumstances",
        detail: "No private details are needed."
      },
      {
        value: "workload",
        title: "Competing academic deadlines",
        detail: "Mention the workload honestly."
      },
      {
        value: "omit",
        title: "Leave the reason out for now",
        detail: "Ask about the next step first."
      }
    ]
  },

  disclosure: {
    id: "disclosure",
    tag: "DISCLOSURE",
    title: "How much would you like to share?",
    hint:
      "You can explain the academic impact without sharing sensitive personal details.",
    options: [
      {
        value: "brief",
        title: "Keep it brief",
        detail: "Mention the situation generally."
      },
      {
        value: "impact",
        title: "Explain the academic impact",
        detail: "Explain how it affected your work."
      },
      {
        value: "custom",
        title: "I will add my own explanation",
        detail: "Use a placeholder and edit it later."
      }
    ]
  },

  time: {
    id: "time",
    tag: "YOUR REQUEST",
    title: "How much extra time will you request?",
    hint: "This is your preference, not a policy allowance or approval.",
    options: [
      {
        value: "2",
        title: "Two extra days",
        detail: "A short extension."
      },
      {
        value: "3",
        title: "Three extra days",
        detail: "A little more time."
      },
      {
        value: "7",
        title: "One extra week",
        detail: "More time to complete the work."
      },
      {
        value: "discuss",
        title: "I am not sure yet",
        detail: "Ask whether an alternative deadline is possible."
      }
    ]
  },

  tone: {
    id: "tone",
    tag: "FINAL DETAIL",
    title: "How would you like it to sound?",
    hint: "Every option stays respectful and appropriate for academic email.",
    options: [
      {
        value: "warm",
        title: "Warm and respectful",
        detail: "Polite, natural and considerate."
      },
      {
        value: "formal",
        title: "More formal",
        detail: "Professional and measured."
      },
      {
        value: "concise",
        title: "Short and clear",
        detail: "Straight to the point without sounding abrupt."
      }
    ]
  }
};

const routeMap = {
  extension: {
    label: "Extension request",
    purpose: "Ask whether an alternative deadline may be possible",
    application: "A formal extension process may apply",
    source: "General Academic Regulations 9.6"
  },

  grade: {
    label: "Grade or feedback question",
    purpose: "Ask for clarification about the grade or feedback",
    application:
      "A formal review goes to the Faculty Dean, within 14 working days",
    source: "General Academic Regulations 9.2"
  },

  exam: {
    label: "Examination procedure",
    purpose: "Explain the examination situation and ask what to do next",
    application:
      "The regulations do not set a University-wide exam absence procedure",
    source: "General Academic Regulations 13, plus course assessment scheme"
  },

  absence: {
    label: "Absence report",
    purpose: "Report the absence and ask what action is required",
    application:
      "An absence over 7 days needs a leave application form, not just an email",
    source: "General Academic Regulations 13.1"
  },

  review: {
    label: "Review or appeal enquiry",
    purpose: "Ask how to begin a formal review or appeal",
    application:
      "A course grade goes through 9.2; a Board of Examiners decision goes to SAppC",
    source: "General Academic Regulations 9.2 and Procedures 4.5"
  },

  unsure: {
    label: "General academic enquiry",
    purpose: "Ask which procedure applies to your situation",
    application: "The correct process has not yet been identified",
    source: "Official university contact page"
  }
};

const answers = {};
let currentStep = 0;
let savedDraft = null;
let isReviewMode = false;

let data = {
  rules: [],
  services: [],
  sources: {},
  programmeCoverage: [],
  knownGaps: [],
  violations: []
};
let gate = null;
let lint = { findings: [], placeholders: [], blocking: false };

const form = document.querySelector("#step-form");
const questionCard = document.querySelector("#question-card");
const resultCard = document.querySelector("#result-card");

const questionTag = document.querySelector("#question-tag");
const questionTitle = document.querySelector("#question-title");
const questionHint = document.querySelector("#question-hint");
const choices = document.querySelector("#choices");

const backButton = document.querySelector("#back-button");
const nextButton = document.querySelector("#next-button");

const progress = document.querySelector("#journey-progress");
const progressStepText = document.querySelector("#progress-step-text");
const progressCaption = document.querySelector("#progress-caption");

const inlinePolicy = document.querySelector("#inline-policy-checkpoint");
const inlinePolicyTitle = document.querySelector("#inline-policy-title");
const inlinePolicyText = document.querySelector("#inline-policy-text");

const draftEditor = document.querySelector("#email-draft");
const draftPreview = document.querySelector("#draft-preview");
const toggleReview = document.querySelector("#toggle-review");
const reviewLegend = document.querySelector("#review-legend");
const copyStatus = document.querySelector("#copy-status");

const utilityPanel = document.querySelector("#utility-panel");
const utilityTitle = document.querySelector("#utility-title");
const utilityContent = document.querySelector("#utility-content");

/* ---------- Step sequence ---------- */

function getSteps() {
  const sequence = SEQUENCES[answers.requestType] || SEQUENCES.unsure;

  return sequence.map(id => {
    const definition = STEP_DEFS[id];

    if (definition.variants) {
      const variant =
        definition.variants[answers.requestType] ||
        definition.variants.extension;

      return Object.assign({}, definition, variant, { id });
    }

    return definition;
  });
}

function animateCard(card) {
  card.classList.remove("entering");

  void card.offsetWidth;

  card.classList.add("entering");
}

function setProgress(value, caption) {
  progress.value = value;
  progress.textContent = `${value}%`;
  progressCaption.textContent = caption;
}

function getJourneyStage(index, total) {
  if (index <= 1) {
    return 1;
  }

  if (index >= total - 1) {
    return 3;
  }

  return 2;
}

function updateStepNavigation(total) {
  const activeStage = getJourneyStage(currentStep, total);
  const indicators = document.querySelectorAll("[data-step-indicator]");

  indicators.forEach(indicator => {
    const stage = Number(indicator.dataset.stepIndicator);

    indicator.classList.toggle("active", stage === activeStage - 1);
    indicator.classList.toggle("completed", stage < activeStage - 1);
  });

  progressStepText.textContent = `Step ${activeStage} of 3`;
}

/* ---------- Inline checkpoint ---------- */

function updateInlinePolicyCheckpoint() {
  const preview = window.MailStoneGatekeeper.preview(data.rules, answers, data);

  if (!preview) {
    inlinePolicy.hidden = true;
    return;
  }

  inlinePolicyTitle.textContent = preview.title;
  inlinePolicyText.textContent = preview.text;
  inlinePolicy.hidden = false;
}

/* ---------- Question rendering ---------- */

function renderStep(moveFocus = true) {
  questionCard.hidden = false;
  resultCard.hidden = true;

  const steps = getSteps();

  if (currentStep > steps.length - 1) {
    currentStep = steps.length - 1;
  }

  const step = steps[currentStep];

  questionTag.textContent = step.tag;
  questionTitle.textContent = step.title;
  questionHint.textContent = step.hint;
  choices.replaceChildren();

  step.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = step.id;
    input.value = option.value;
    input.required = true;
    input.checked = answers[step.id] === option.value;

    const copy = document.createElement("span");
    copy.className = "choice-copy";

    const optionTitle = document.createElement("span");
    optionTitle.className = "choice-title";
    optionTitle.id = `${step.id}-title-${index}`;
    optionTitle.textContent = option.title;

    const detail = document.createElement("span");
    detail.className = "choice-detail";
    detail.id = `${step.id}-detail-${index}`;
    detail.textContent = option.detail;

    input.setAttribute("aria-labelledby", optionTitle.id);
    input.setAttribute("aria-describedby", detail.id);

    if (input.checked) {
      label.classList.add("selected");
    }

    input.addEventListener("change", () => {
      if (answers[step.id] !== option.value) {
        savedDraft = null;
      }

      answers[step.id] = option.value;

      /*
        Changing the request type changes the length of the flow, so later
        answers that no longer apply are cleared rather than carried over.
      */
      if (step.id === "requestType") {
        const allowed = SEQUENCES[option.value] || SEQUENCES.unsure;

        Object.keys(answers).forEach(key => {
          if (!allowed.includes(key)) {
            delete answers[key];
          }
        });
      }

      choices.querySelectorAll(".choice").forEach(item => {
        const radio = item.querySelector("input");

        item.classList.toggle("selected", radio.checked);
      });

      updateInlinePolicyCheckpoint();

      nextButton.disabled = false;
    });

    copy.append(optionTitle, detail);
    label.append(input, copy);
    choices.append(label);
  });

  backButton.disabled = currentStep === 0;
  nextButton.disabled = !answers[step.id];

  nextButton.textContent =
    currentStep === steps.length - 1 ? "See my draft →" : "Continue →";

  setProgress(
    steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 0,
    CAPTIONS[step.id] || "One step at a time"
  );

  updateStepNavigation(steps.length);
  updateInlinePolicyCheckpoint();
  animateCard(questionCard);

  if (moveFocus) {
    questionTitle.focus();
  }
}

/* ---------- Draft content ---------- */

function getDurationText() {
  const durations = {
    "2": "two extra days",
    "3": "three extra days",
    "7": "one extra week"
  };

  return durations[answers.time] || "an alternative period";
}

/*
  The previous version returned identical text for health and personal
  circumstances, and identical text for brief and impact. The dimension had
  no effect on the output. These are now distinct.
*/
function getReasonText() {
  const reason = answers.reason;
  const disclosure = answers.disclosure;

  if (!reason || reason === "omit") {
    return "";
  }

  if (disclosure === "custom") {
    return "[Add a brief explanation of your circumstances if needed.]";
  }

  const brief = {
    health:
      "A health issue has affected my ability to complete the work by the original deadline.",
    personal:
      "Personal circumstances have affected my ability to complete the work by the original deadline.",
    workload: "I have been managing several academic responsibilities at once."
  };

  const impact = {
    health:
      "A health issue has affected my ability to work for part of the time available, and I have not been able to complete the work to the standard I intended.",
    personal:
      "Personal circumstances have taken time and attention away from my studies, and I have not been able to complete the work to the standard I intended.",
    workload:
      "Competing academic deadlines have reduced the time available for this work, and I have not been able to complete it to the standard I intended."
  };

  const table = disclosure === "impact" ? impact : brief;

  /*
    "Complete the work by the original deadline" is coursework language. In an
    examination message it describes the wrong object, so the reason sentence
    is rephrased rather than reused.
  */
  if (answers.requestType === "exam") {
    const examTable = {
      health:
        "A health issue has affected my preparation for this assessment.",
      personal:
        "Personal circumstances have affected my preparation for this assessment.",
      workload:
        "Competing academic commitments have affected my preparation for this assessment."
    };

    return examTable[reason] || "";
  }

  return table[reason] || "";
}

function getToneClosing() {
  const closings = {
    warm: "Thank you for your time and consideration.",
    formal: "Thank you for considering my request.",
    concise: "Thank you for your consideration."
  };

  return closings[answers.tone] || closings.warm;
}

function buildExtensionDraft() {
  const followup = answers.situation === "followup";
  const reasonText = getReasonText();
  const postDeadline = gate && gate.draftMode === "post_deadline";

  if (postDeadline) {
    return buildPostDeadlineDraft(reasonText, followup);
  }

  const subject = followup
    ? "Follow-up on extension request — [Assignment name], [Course code]"
    : "Extension request — [Assignment name], [Course code]";

  const firstLines = {
    warm: followup
      ? "I hope you are well. I am following up on my earlier request for an extension for [Assignment name] in [Course code], originally due on [Original deadline]."
      : "I hope you are well. I would like to ask whether it would be possible to have an extension for [Assignment name] in [Course code], due on [Original deadline].",
    formal: followup
      ? "I am writing to follow up on my previous extension request for [Assignment name] in [Course code], originally due on [Original deadline]."
      : "I am writing to request an extension for [Assignment name] in [Course code], due on [Original deadline].",
    concise: followup
      ? "Could you please let me know if there is an update on my extension request for [Assignment name] in [Course code], originally due on [Original deadline]?"
      : "Could I please request an extension for [Assignment name] in [Course code], due on [Original deadline]?"
  };

  const timing =
    answers.time === "discuss"
      ? "Would it be possible to discuss an alternative submission deadline?"
      : followup
        ? `If an extension is possible, my current preference would be ${getDurationText()} beyond the original deadline.`
        : `Would an extension of ${getDurationText()} beyond the original deadline be possible?`;

  const paragraphs = [
    `Subject: ${subject}`,
    "Dear [Recipient title and surname],",
    firstLines[answers.tone],
    reasonText,
    timing
  ];

  if (answers.tone !== "concise") {
    paragraphs.push(
      "I understand that any change to the deadline would require your approval, and that a late submission may affect the grade for this assignment."
    );
  }

  paragraphs.push(getToneClosing(), "Kind regards,\n[Your name]\n[Student ID]");

  return paragraphs.filter(Boolean).join("\n\n");
}

/*
  After the due date, GAR 9.6.1 no longer describes anything the student can
  do, so the draft must not ask for "permission in advance". It states the
  situation, asks what remains, and states the preference conditionally.
*/
function buildPostDeadlineDraft(reasonText, followup) {
  const subject = followup
    ? "Follow-up — late submission, [Assignment name], [Course code]"
    : "Late submission — [Assignment name], [Course code]";

  const openings = {
    warm:
      "I hope you are well. I am writing about [Assignment name] in [Course code], which was due on [Original deadline]. I was not able to submit it by that date, and I am sorry for not writing to you sooner.",
    formal:
      "I am writing regarding [Assignment name] in [Course code], which was due on [Original deadline]. I was unable to submit the work by that date.",
    concise:
      "I am writing about [Assignment name] in [Course code], due on [Original deadline], which I was unable to submit on time."
  };

  const asks = {
    warm:
      "Could you let me know what options are available to me now, and whether there is anything I should submit in support of my case?",
    formal:
      "I would be grateful to know what options remain available to me, and whether any supporting documentation is required.",
    concise:
      "Could you let me know what options I have now, and whether I should send anything in support?"
  };

  const paragraphs = [
    `Subject: ${subject}`,
    "Dear [Recipient title and surname],",
    openings[answers.tone],
    reasonText
  ];

  if (answers.time !== "discuss") {
    paragraphs.push(
      `If any extension were possible, ${getDurationText()} would allow me to submit work I can stand behind. I understand this is not something you can decide in advance of seeing my situation.`
    );
  }

  paragraphs.push(
    "I understand that work submitted late without prior approval is treated as not submitted, and that a late submission that is approved may still affect the grade for this assignment.",
    asks[answers.tone],
    getToneClosing(),
    "Kind regards,\n[Your name]\n[Student ID]"
  );

  return paragraphs.filter(Boolean).join("\n\n");
}

function buildGeneralDraft() {
  const requestType = answers.requestType;

  const subjects = {
    extension: "Question about a coursework deadline — [Assignment name], [Course code]",
    grade: "Question about feedback — [Assignment name], [Course code]",
    exam: "Question about examination procedure — [Course code]",
    absence: "Question about absence procedure — [Course code]",
    review: "Question about review or appeal procedure — [Course code]",
    unsure: "Question about the appropriate academic procedure"
  };

  const purposes = {
    extension:
      "I am writing about [Assignment name] in [Course code], due on [Original deadline]. Before I rely on any procedure, I would like to confirm which one applies to my programme.",
    grade:
      "I am writing to ask for clarification about the feedback or grade for [Assignment name] in [Course code]. I am not asking you to change the mark; I would like to understand the requirement before the next assignment.",
    exam:
      "I am writing to ask what procedure I should follow regarding [Exam name] in [Course code].",
    absence:
      "I am writing to let you know that I may be unable to attend [Class or activity] on [Date].",
    review:
      "I am writing to ask how I can find the appropriate review or appeal procedure for [Assessment name] in [Course code].",
    unsure:
      "I am writing to ask which academic procedure may apply to my situation in [Course code]."
  };

  const requests = {
    extension:
      "Could you please let me know what options are available to me, and whether a separate form or application is required?",
    grade:
      "Could you please clarify the relevant feedback, or let me know who I should contact for further information?",
    exam:
      "Could you please let me know what steps I should take and whether a separate form is required?",
    absence:
      "Could you please let me know what information or documentation is required?",
    review:
      "Could you please direct me to the official procedure and any relevant deadline?",
    unsure:
      "Could you please let me know which office, form or procedure I should use?"
  };

  const paragraphs = [
    `Subject: ${subjects[requestType] || subjects.unsure}`,
    "Dear [Recipient title and surname],",
    purposes[requestType] || purposes.unsure,
    getReasonText(),
    requests[requestType] || requests.unsure,
    getToneClosing(),
    "Kind regards,\n[Your name]\n[Student ID]"
  ];

  return paragraphs.filter(Boolean).join("\n\n");
}

function buildDraft() {
  /*
    When the Gatekeeper cannot place this student inside the collected
    regulations, the extension template must not run: its whole structure
    ("permission in advance", "would an extension of X be possible") encodes
    a clause that may not govern this programme. Fall back to the neutral
    enquiry, which asks which procedure applies instead of assuming one.
  */
  if (gate && gate.draftMode === "scope_gap") {
    return buildGeneralDraft();
  }

  if (answers.requestType === "extension") {
    return buildExtensionDraft();
  }

  return buildGeneralDraft();
}

/* ---------- Result panels ---------- */

function renderRoute() {
  const route = routeMap[answers.requestType] || routeMap.unsure;
  const rule = gate && gate.primary;

  /*
    routeMap describes the route for the collected regulations. When the
    Gatekeeper cannot place this student inside them, the route text must not
    be shown either — otherwise the panel cites GAR 9.6 two centimetres below
    a panel saying that GAR 9.6 does not apply to this student.
  */
  /*
    Three reasons the route text can be withheld, and they are not the same:
      out_of_scope  — the regulations for this programme are not in the corpus
      no_rule       — the programme is covered, but nothing addresses this topic
      programme_unknown — the student has not said which programme they are on
    Collapsing them into one message tells the student the wrong reason.
  */
  const coverage = gate ? gate.coverage : "covered";
  const scoped = coverage === "covered";

  document.querySelector("#route-tab-subtitle").textContent = route.label;

  let contact = "Confirm through an official university page";

  if (rule && rule.route && rule.route.contact_role) {
    contact = rule.route.contact_role;
  } else if (coverage === "out_of_scope") {
    contact =
      gate.programme === "tpg" || gate.programme === "rpg"
        ? "Your programme office or the Graduate School"
        : "Your programme office";
  } else if (coverage === "no_rule") {
    contact =
      "Your course instructor — ask which office or document sets the procedure";
  }

  document.querySelector("#route-contact").textContent = contact;

  document.querySelector("#route-purpose").textContent = !scoped
    ? coverage === "no_rule"
      ? "Ask which procedure applies, without naming one"
      : "Ask which procedure applies to your programme"
    : gate && gate.closedRoute
      ? "Explain the situation and ask what options remain"
      : route.purpose;

  document.querySelector("#route-application").textContent = scoped
    ? gate && gate.closedRoute
      ? "Not established — the advance-permission route has already passed"
      : route.application
    : coverage === "no_rule"
      ? "Set by course or programme documents, not by the central regulations"
      : "Not established for your programme";

  const gapForRoute = (data.knownGaps || []).find(
    item =>
      item.surfaces_as === "empty_state" &&
      (item.request_types || []).includes(answers.requestType)
  );

  document.querySelector("#route-source").textContent = scoped
    ? route.source
    : coverage === "no_rule"
      ? gapForRoute && gapForRoute.status === "by_design"
        ? "No clause applied — no topic has been selected yet"
        : "No clause applied — the central regulations do not address this"
      : "No clause applied — your programme's regulations are not in the policy base";
}

function renderResultPolicy() {
  const panel = document.querySelector("#result-policy");
  const title = document.querySelector("#result-policy-title");
  const text = document.querySelector("#result-policy-text");
  const source = document.querySelector("#result-policy-source");

  /*
    Scope gap. A clause exists and the wording would read perfectly, but it
    governs a different programme. Quoting it here is the failure mode this
    project exists to prevent, so the panel reports the gap instead.
  */
  if (gate && gate.coverage === "out_of_scope") {
    const row = gate.programmeRow || {};
    const document_ = data.sources[row.governing_document] || {};

    title.textContent = "Your programme's regulations are not in this policy base";

    text.textContent =
      "A regulation exists, but it belongs to a different programme. MailStone will not apply it to you. The draft is framed as a general enquiry instead.";

    source.innerHTML = `
      <p><strong>Your programme:</strong> ${row.label || gate.programme}</p>
      <p><strong>Governing document:</strong> ${document_.title || row.governing_document || "not identified"}</p>
      <p><strong>Status:</strong> ${document_.verification_status || "not in the corpus"}</p>
      ${row.gap_reason ? `<p><strong>Why it is missing:</strong> ${row.gap_reason}</p>` : ""}
      ${
        document_.locator
          ? `<p><strong>Where it is listed:</strong> <a href="${document_.locator}" target="_blank" rel="noopener">open locator page</a></p>`
          : ""
      }
      <p class="policy-source-note">This is a scope limit in the policy base, not a finding about your situation. Applying another programme's clause here would be a wrong answer even with a perfect quotation.</p>
    `;

    panel.hidden = false;
    return;
  }

  /*
    Empty state, part 2: the student's programme IS covered, but nothing in
    the corpus speaks to this request. That is a different fact from "no rule
    matched", and it is worth saying precisely, because the gap is a finding
    about the regulations rather than a limitation of the student's search.
  */
  if (!gate || !gate.primary) {
    const gap = (data.knownGaps || []).find(
      item =>
        item.surfaces_as === "empty_state" &&
        (item.request_types || []).includes(answers.requestType)
    );

    const byDesign = gap && gap.status === "by_design";

    title.textContent = gap
      ? byDesign
        ? "No procedure has been identified yet"
        : "The regulations are silent on this"
      : "No verified policy matches this request";

    text.textContent = gap
      ? gap.student_facing_summary
      : "MailStone will not state a procedure it cannot cite. The draft is framed as a request for guidance.";

    source.innerHTML = gap
      ? `
        <p><strong>Finding:</strong> ${gap.gap_id}</p>
        <p><strong>Status:</strong> ${gap.status.replaceAll("_", " ")}</p>
        <p><strong>What the draft does instead:</strong> asks which procedure applies, without naming one.</p>
        <p class="policy-source-note">${
          byDesign
            ? "This is not a gap in the regulations. It means the request has not been described precisely enough to select a clause."
            : "An absent clause is a property of the corpus. It is reported here rather than filled with a plausible-sounding procedure."
        }</p>
      `
      : "<p>No clause in the current policy base speaks to this request type. This is a gap in the corpus, not evidence that no rule exists.</p>";

    panel.hidden = false;
    return;
  }

  const rule = gate.primary;

  title.textContent = gate.closedRoute
    ? "The usual route may already be closed"
    : `Policy checkpoint — ${rule.authority.section}`;

  text.textContent = rule.plain;

  const confidence = {
    assert: "Verified against the official source.",
    suggest:
      "This is the author's reading of two clauses together, not a single stated rule. Confirm before relying on it.",
    withhold: "Not verified. MailStone will not assert this."
  }[gate.assertion];

  const supporting = gate.supporting
    .map(
      item =>
        `<li><strong>${item.authority.section}</strong> — ${item.authority.source_id}</li>`
    )
    .join("");

  const sourceDoc = data.sources[rule.authority.source_id] || {};
  const sourceUrl = sourceDoc.url || "#";
  const scope = window.MailStoneGatekeeper.resolveScope(rule, data.sources);

  source.innerHTML = `
    <p><strong>Clause:</strong> ${rule.authority.section} (${rule.rule_id})</p>
    <p><strong>Original wording:</strong> “${rule.authority.quote}”</p>
    <p><strong>Source:</strong> ${sourceDoc.title || rule.authority.source_id} ·
      <a href="${sourceUrl}" target="_blank" rel="noopener">open source</a></p>
    <p><strong>Retrieved:</strong> ${sourceDoc.retrieved_date || "not recorded"}</p>
    ${
      scope && scope.programme_levels
        ? `<p><strong>Applies to:</strong> ${scope.programme_levels.join(", ")}${
            scope.cohort_from ? ` · intake ${scope.cohort_from} onwards` : ""
          }${scope.cohort_to ? ` · intake up to ${scope.cohort_to}` : ""}</p>`
        : ""
    }
    <p><strong>Status:</strong> ${confidence}</p>
    ${supporting ? `<p><strong>Also relevant:</strong></p><ul>${supporting}</ul>` : ""}
    <p class="policy-source-note">A clause that is not in this corpus may still exist. Absence here is not evidence of absence in the regulations.</p>
  `;

  panel.hidden = false;
}

/*
  Support services are rendered in their own panel, never inside the policy
  checkpoint. Mixing them would let a service listing borrow the authority of
  a regulation: "the office can arrange X" is not "you are entitled to X".
*/
function renderSupport() {
  const panel = document.querySelector("#result-support");
  const text = document.querySelector("#result-support-text");
  const list = document.querySelector("#result-support-route");
  const note = document.querySelector("#result-support-note");

  const service = gate && gate.services && gate.services[0];

  if (!service) {
    panel.hidden = true;
    return;
  }

  text.textContent = service.plain;
  list.replaceChildren();

  const rows = [
    ["Contact", service.route.contact_role],
    ["How to reach them", service.route.contact_detail],
    ["Before you write", service.route.lookup_instruction]
  ];

  rows
    .filter(row => row[1])
    .forEach(([label, value]) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");

      dt.textContent = label;
      dd.textContent = value;

      wrap.append(dt, dd);
      list.append(wrap);
    });

  /*
    Open questions are shown as "Not established" rows. The data structure
    changed on 2026-11-09: open_questions became objects with a "question"
    field, and resolved_questions carry their resolution. Only items in
    open_questions are rendered here — resolved questions are confirmed
    findings, not blanks.

    Backward compatibility: if open_questions is still an array of strings
    (e.g., from a cached older data file), the string itself is the question.
  */
  const openQuestions = service.open_questions || [];

  openQuestions.forEach(entry => {
    const questionText =
      typeof entry === "string" ? entry : entry.question;

    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");

    dt.textContent = "Not established";
    dd.textContent = questionText;

    wrap.append(dt, dd);
    list.append(wrap);
  });

  /*
    Resolved questions are listed as confirmed findings, not as open blanks.
    They are shown so the student knows what the service covers, with the
    source cited. This is the difference between "we don't know" and "the
    web page says it covers X" — and the student needs to see both.
  */
  const resolvedQuestions = service.resolved_questions || [];

  resolvedQuestions.forEach(entry => {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");

    dt.textContent = "Confirmed";
    dd.textContent = `${entry.question} — ${entry.resolution}`;

    wrap.append(dt, dd);
    list.append(wrap);
  });

  note.textContent =
    gate && gate.closedRoute
      ? "This is a support service, not a regulation, and it is not the route you were already on. The web page confirms that assignment deadline extensions are among the accommodations they can consider. Whether this can be arranged after a deadline has passed is the one question still open — ask, do not assume."
      : "This is a support service, not a regulation. It tells you who to ask, not what you will be given. The web page lists the accommodations they can consider.";

  panel.hidden = false;
}

function createFactRow(label, value) {
  const row = document.createElement("div");
  row.className = "fact-row";

  const labelElement = document.createElement("strong");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.textContent = value;

  row.append(labelElement, valueElement);

  return row;
}

function renderFacts() {
  const confirmed = document.querySelector("#confirmed-facts");
  const request = document.querySelector("#request-facts");
  const unknown = document.querySelector("#unknown-facts");

  confirmed.replaceChildren();
  request.replaceChildren();
  unknown.replaceChildren();

  confirmed.append(
    createFactRow("Approval status", "Not yet approved"),
    createFactRow("Email sending", "Nothing will be sent automatically"),
    createFactRow(
      "Programme",
      gate && gate.programmeRow ? gate.programmeRow.label : "Not stated"
    ),
    createFactRow(
      "Policy source",
      gate && gate.primary
        ? gate.primary.authority.section
        : gate && gate.coverage === "out_of_scope"
          ? "Not applicable to your programme"
          : "None matched"
    )
  );

  if (answers.requestType === "extension") {
    request.append(
      createFactRow("Main request", "Ask for more time"),
      createFactRow(
        "Requested duration",
        answers.time === "discuss" ? "Not decided yet" : getDurationText()
      ),
      createFactRow(
        "Route open",
        !gate || gate.coverage !== "covered"
          ? "Unknown — no clause applied"
          : gate.closedRoute
            ? "No — deadline has passed"
            : "Yes"
      )
    );
  } else {
    const route = routeMap[answers.requestType] || routeMap.unsure;

    request.append(
      createFactRow("Main request", route.label),
      createFactRow("Goal", answers.goal || "Not confirmed")
    );
  }

  unknown.append(
    createFactRow("Course code", "Must be added"),
    createFactRow("Original date", "Must be checked"),
    createFactRow("Supporting document", "Not confirmed")
  );
}

function renderLearningTips() {
  const list = document.querySelector("#learning-tips");

  const tips = {
    extension: [
      "The subject identifies the assignment and course.",
      "The original deadline is named, so the recipient can check it against the record.",
      "The request asks whether an alternative deadline is possible.",
      "The email does not say that an extension has already been approved."
    ],

    grade: [
      "The message asks for clarification before making an accusation.",
      "It explicitly disclaims an intention to change the mark, which keeps it at the first stage.",
      "A formal review is not claimed unless its grounds and deadline are met."
    ],

    exam: [
      "The examination situation is explained briefly.",
      "The message asks what procedure should be followed.",
      "Supporting documents are only mentioned if they are actually available."
    ],

    absence: [
      "The message explains the absence without unnecessary private details.",
      "It asks the recipient what information or document is needed."
    ],

    review: [
      "The message asks for the official review or appeal process.",
      "It asks about deadlines instead of assuming an appeal is available."
    ],

    unsure: [
      "The message is framed as a request for guidance.",
      "It does not guess which department or procedure is correct."
    ]
  };

  /*
    The scope-gap draft is a different document with a different purpose, so
    the explanation must not describe the template it replaced.
  */
  const scopeGapTips = [
    "The message asks which procedure applies instead of assuming one.",
    "No clause is named, because no collected clause governs this programme.",
    "The deadline is still stated, so the recipient can act without a follow-up question.",
    "It does not claim that any outcome has been approved or is available."
  ];

  /*
    Distinct from the scope gap: here the programme's regulations ARE in the
    corpus, and the regulations themselves are silent on this topic. Saying
    "not in the policy base" would blame the wrong thing.
  */
  const noRuleTips = [
    "The message asks which procedure applies, because the central regulations do not set one out.",
    "It states the facts a reader would need — course, examination, date — without interpreting them.",
    "It does not name a form or a deadline it cannot verify.",
    "It asks one question, so a single reply can settle it."
  ];

  /*
    The post-deadline draft is a different document from the standard one: it
    cannot ask for permission in advance, so an explanation that describes the
    standard draft would be describing an email the student is not looking at.
  */
  const postDeadlineTips = [
    "The subject still names the assignment and course, so the message can be matched to a record.",
    "It states the situation and the original deadline without arguing that the deadline should move.",
    "It asks what options remain, rather than asking for permission it is too late to grant.",
    "It does not claim that anything has been approved, waived, or promised."
  ];

  const gapForRequest = (data.knownGaps || []).find(
    item =>
      item.surfaces_as === "empty_state" &&
      (item.request_types || []).includes(answers.requestType)
  );

  let selectedTips = tips[answers.requestType] || tips.unsure;

  if (gate && gate.coverage === "no_rule") {
    /* A by-design empty state is not a statement about the regulations. */
    selectedTips =
      gapForRequest && gapForRequest.status === "by_design"
        ? tips.unsure
        : noRuleTips;
  } else if (gate && gate.coverage !== "covered") {
    selectedTips = scopeGapTips;
  } else if (gate && gate.closedRoute) {
    selectedTips = postDeadlineTips;
  }

  list.innerHTML = selectedTips.map(tip => `<li>${tip}</li>`).join("");
}

/* ---------- Lint panel ---------- */

function renderLint() {
  const panel = document.querySelector("#lint-panel");
  const summary = document.querySelector("#lint-summary");
  const list = document.querySelector("#lint-list");

  if (!panel) {
    return;
  }

  list.replaceChildren();

  const blockCount = lint.findings.filter(f => f.severity === "block").length;
  const warnCount = lint.findings.filter(f => f.severity === "warn").length;

  if (lint.findings.length === 0) {
    summary.textContent = "No checks triggered.";
    panel.dataset.state = "clear";
  } else {
    summary.textContent = `${blockCount} to fix · ${warnCount} to check`;
    panel.dataset.state = blockCount > 0 ? "blocked" : "check";
  }

  lint.findings.forEach(item => {
    const row = document.createElement("div");
    row.className = `lint-item lint-${item.severity}`;

    const head = document.createElement("div");
    head.className = "lint-head";

    const badge = document.createElement("span");
    badge.className = "lint-badge";
    badge.textContent =
      item.severity === "block" ? "Fix" : item.severity === "warn" ? "Check" : "Note";

    const name = document.createElement("strong");
    name.textContent = item.name;

    head.append(badge, name);

    const message = document.createElement("p");
    message.className = "lint-message";
    message.textContent = item.message;

    row.append(head, message);

    if (item.ranges.length) {
      const quotes = item.ranges
        .slice(0, 3)
        .map(range => `“${range.text}”`)
        .join(", ");

      const quote = document.createElement("p");
      quote.className = "lint-quote";
      quote.textContent = quotes;

      row.append(quote);
    }

    list.append(row);
  });
}

/* ---------- Review preview ---------- */

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createReviewPreview(text) {
  const marks = [];

  lint.placeholders.forEach(item =>
    marks.push(Object.assign({}, item, { cls: "preview-placeholder" }))
  );

  lint.findings.forEach(item => {
    item.ranges.forEach(range =>
      marks.push(
        Object.assign({}, range, {
          cls:
            item.severity === "block"
              ? "preview-warning"
              : "preview-caution"
        })
      )
    );
  });

  marks.sort((a, b) => a.start - b.start || b.end - a.end);

  let output = "";
  let cursor = 0;

  marks.forEach(mark => {
    if (mark.start < cursor) {
      return;
    }

    output += escapeHtml(text.slice(cursor, mark.start));
    output += `<mark class="${mark.cls}">${escapeHtml(
      text.slice(mark.start, mark.end)
    )}</mark>`;
    cursor = mark.end;
  });

  output += escapeHtml(text.slice(cursor));

  return output;
}

function updateReviewMode() {
  isReviewMode = !isReviewMode;

  toggleReview.setAttribute("aria-pressed", String(isReviewMode));
  toggleReview.textContent = isReviewMode ? "Back to editing" : "Check this draft";

  draftEditor.hidden = isReviewMode;
  draftPreview.hidden = !isReviewMode;
  reviewLegend.hidden = !isReviewMode;

  if (isReviewMode) {
    draftPreview.innerHTML = createReviewPreview(draftEditor.value);
  }
}

function refreshLint() {
  const recipientLevel =
    gate && gate.primary && gate.primary.route && gate.primary.route.recipient_level
      ? gate.primary.route.recipient_level
      : "course";

  lint = window.MailStoneLint.run(draftEditor.value, {
    answers,
    gate,
    recipientLevel,
    violations: data.violations
  });

  renderLint();

  if (isReviewMode) {
    draftPreview.innerHTML = createReviewPreview(draftEditor.value);
  }
}

function validateFactLock() {
  const blocking = lint.findings.filter(item => item.severity === "block");

  if (blocking.length) {
    return {
      valid: false,
      message: `Fix before copying: ${blocking[0].name}. ${blocking[0].message}`
    };
  }

  return { valid: true, message: "" };
}

function getPlaceholders(text) {
  return text.match(/\[[^\]]+\]/g) || [];
}

function showResult() {
  questionCard.hidden = true;
  resultCard.hidden = false;

  gate = window.MailStoneGatekeeper.decide(data.rules, answers, data);

  if (savedDraft === null) {
    savedDraft = buildDraft();
  }

  draftEditor.value = savedDraft;

  renderRoute();
  renderResultPolicy();
  renderSupport();
  renderFacts();
  renderLearningTips();

  refreshLint();

  currentStep = getSteps().length - 1;

  setProgress(100, "Ready for your review");
  updateStepNavigation(getSteps().length);
  animateCard(resultCard);

  document.querySelector("#result-title").focus();
}

function openUtility(type) {
  const utilityText = {
    privacy:
      "MailStone does not require sign-in, does not send emails automatically and does not save your answers in this prototype.",

    help:
      "Choose one option at a time. You can go back, review the policy checkpoint and edit the final draft before copying it.",

    journey:
      "MailStone uses three stages: understand the issue, provide relevant details and review the draft."
  };

  const utilityTitles = {
    privacy: "Privacy",
    help: "How MailStone works",
    journey: "Your journey"
  };

  utilityTitle.textContent = utilityTitles[type];
  utilityContent.textContent = utilityText[type];

  utilityPanel.hidden = false;
}

/* ---------- Events ---------- */

form.addEventListener("submit", event => {
  event.preventDefault();

  const steps = getSteps();
  const step = steps[currentStep];

  if (!answers[step.id]) {
    return;
  }

  if (currentStep < steps.length - 1) {
    currentStep += 1;
    renderStep();
  } else {
    showResult();
  }
});

backButton.addEventListener("click", () => {
  if (currentStep > 0) {
    currentStep -= 1;
    renderStep();
  }
});

draftEditor.addEventListener("input", () => {
  savedDraft = draftEditor.value;
  copyStatus.textContent = "";

  refreshLint();
});

document.querySelector("#route-tab").addEventListener("click", event => {
  const tab = event.currentTarget;
  const details = document.querySelector("#route-details");
  const arrow = tab.querySelector(".route-tab-arrow");

  const isOpen = tab.getAttribute("aria-expanded") === "true";

  tab.setAttribute("aria-expanded", String(!isOpen));
  details.hidden = isOpen;
  arrow.textContent = isOpen ? "＋" : "−";
});

document
  .querySelector("#show-policy-source")
  .addEventListener("click", event => {
    const source = document.querySelector("#result-policy-source");
    const button = event.currentTarget;

    const isHidden = source.hidden;

    source.hidden = !isHidden;
    button.textContent = isHidden
      ? "Hide source information"
      : "Show source information";
  });

toggleReview.addEventListener("click", updateReviewMode);

document.querySelector("#edit-answers").addEventListener("click", () => {
  const hasManualEdits = savedDraft !== null && savedDraft !== buildDraft();

  if (hasManualEdits) {
    const proceed = window.confirm(
      "Changing your choices may replace your edited draft with a new template. Copy your edits first if you want to keep them. Continue?"
    );

    if (!proceed) {
      return;
    }
  }

  if (isReviewMode) {
    updateReviewMode();
  }

  currentStep = getSteps().length - 1;
  renderStep();
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  refreshLint();

  const draftText = draftEditor.value;
  const validation = validateFactLock();

  if (!validation.valid) {
    copyStatus.textContent = validation.message;
    draftEditor.hidden = false;
    draftPreview.hidden = true;
    reviewLegend.hidden = true;
    isReviewMode = false;
    toggleReview.textContent = "Check this draft";
    draftEditor.focus();
    return;
  }

  const placeholders = getPlaceholders(draftText);

  let message = "Draft copied.";

  if (placeholders.length > 0) {
    message += ` ${placeholders.length} placeholders still to replace.`;
  }

  try {
    await navigator.clipboard.writeText(draftText);

    copyStatus.textContent = `${message} Remember to check every detail before sending.`;
  } catch {
    draftEditor.hidden = false;
    draftPreview.hidden = true;
    reviewLegend.hidden = true;

    draftEditor.focus();
    draftEditor.select();

    copyStatus.textContent =
      "Automatic copying is unavailable. The draft is selected; press Command+C on Mac or Ctrl+C on Windows.";
  }
});

document.querySelector("#journey-button").addEventListener("click", () => {
  document.querySelector(".journey").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  openUtility("journey");
});

document.querySelector("#privacy-button").addEventListener("click", () => {
  openUtility("privacy");
});

document.querySelector("#help-button").addEventListener("click", () => {
  openUtility("help");
});

document.querySelector("#close-utility").addEventListener("click", () => {
  utilityPanel.hidden = true;
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    utilityPanel.hidden = true;
  }
});

/* ---------- Start ---------- */

async function loadData() {
  const [policyResponse, sourceResponse, qualityResponse] = await Promise.all([
    fetch("./data/policy/rules.eduhk.json"),
    fetch("./data/policy/sources.json"),
    fetch("./data/quality/violations.json")
  ]);

  if (!policyResponse.ok || !sourceResponse.ok || !qualityResponse.ok) {
    throw new Error("Policy data could not be loaded.");
  }

  const policy = await policyResponse.json();
  const sources = await sourceResponse.json();
  const quality = await qualityResponse.json();

  const sourceById = {};

  sources.sources.forEach(source => {
    sourceById[source.source_id] = source;
  });

  data = {
    rules: policy.rules,
    services: policy.support_services || [],
    sources: sourceById,
    programmeCoverage: sources.programme_coverage || [],
    knownGaps: sources.known_gaps || [],
    violations: quality.violations
  };
}

function showDataError() {
  questionTitle.textContent = "The policy data did not load.";
  questionHint.textContent =
    "This page must be opened through a local server, not by double-clicking the file. In VS Code, right-click index.html and choose Open with Live Server.";
  choices.replaceChildren();
  nextButton.disabled = true;
  backButton.disabled = true;
  inlinePolicy.hidden = true;
}

loadData()
  .then(() => {
    /*
      QA affordance: ?qa=extension-post jumps straight to the result card with
      a fixed answer set. Used to check the result rendering after a change,
      and to reach a given state quickly during a demo. It is not part of the
      student flow and never runs without the query parameter.
    */
    const preset = new URLSearchParams(window.location.search).get("qa");

    const presets = {
      "extension-pre": {
        programme: "ug",
        requestType: "extension",
        timing: "before_deadline",
        goal: "request",
        situation: "new",
        reason: "health",
        disclosure: "brief",
        time: "3",
        tone: "warm"
      },
      "extension-post": {
        programme: "ug",
        requestType: "extension",
        timing: "after_deadline",
        goal: "request",
        situation: "new",
        reason: "health",
        disclosure: "impact",
        time: "7",
        tone: "warm"
      },
      "extension-tpg": {
        programme: "tpg",
        requestType: "extension",
        timing: "before_deadline",
        goal: "request",
        situation: "new",
        reason: "personal",
        disclosure: "brief",
        time: "7",
        tone: "formal"
      },
      "exam-ug": {
        programme: "ug",
        requestType: "exam",
        timing: "after_deadline",
        goal: "procedure",
        situation: "new",
        reason: "health",
        disclosure: "brief",
        tone: "formal"
      },
      grade: {
        programme: "ug",
        requestType: "grade",
        timing: "before_deadline",
        goal: "understand",
        situation: "new",
        tone: "formal"
      },
      unsure: {
        programme: "ug",
        requestType: "unsure",
        goal: "unsure",
        situation: "new",
        reason: "omit",
        disclosure: "brief",
        tone: "warm"
      }
    };

    if (preset && presets[preset]) {
      Object.assign(answers, presets[preset]);
      showResult();
      return;
    }

    /*
      ?step=N opens the flow at question N with a fixed answer set, for
      checking a mid-flow question without clicking through. Same dev-only
      contract as ?qa=: it never runs without the query parameter.
    */
    const step = Number(new URLSearchParams(window.location.search).get("step"));

    if (Number.isInteger(step) && step > 0) {
      Object.assign(answers, {
        programme: "ug",
        requestType: "extension",
        timing: "before_deadline"
      });

      currentStep = Math.min(step, getSteps().length - 1);
    }

    renderStep(false);
  })
  .catch(showDataError);
