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

/*
  Every sequence shares the same three opening steps. This matters because
  getSteps() is called before requestType is known (it falls back to the
  "unsure" list), and again after the student chooses a request type. A shared
  prefix keeps step indices aligned when the sequence changes mid-flow.

  The intake order follows the student's request: course code, teacher name,
  then a guided lookup for the teacher's address. Only afterwards do we ask
  which regulations and which situation apply.
*/
const SEQUENCES = {
  extension: [
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
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
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
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
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "reason",
    "disclosure",
    "tone"
  ],
  grade: [
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "tone"
  ],
  review: [
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
    "programme",
    "requestType",
    "timing",
    "goal",
    "situation",
    "tone"
  ],
  unsure: [
    "courseCode",
    "teacherName",
    "teacherEmail",
    "relationship",
    "programme",
    "requestType",
    "goal",
    "situation",
    "tone"
  ]
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
  courseCode: "Adding the course code",
  teacherName: "Naming your teacher",
  teacherEmail: "Finding the address",
  relationship: "Your relationship with the teacher",
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

  /*
    Course code and teacher name are collected as text answers rather than
    radio options: they are identifiers, not categories. Both offer an
    explicit "not known yet" escape. V09 deliberately treats a bracketed
    course placeholder as "present", so it does not warn here; instead the
    blank is highlighted by the review preview, counted in the copy prompt
    and covered by the sending checklist. Deleting the token entirely would
    hide the one thing most likely to be forgotten before the email is sent.
  */
  courseCode: {
    id: "courseCode",
    type: "text",
    tag: "COURSE IDENTIFIER",
    title: "What is the course code?",
    hint:
      "For example LIN4049. If you do not know it yet, choose \"Not known yet\" and the draft will leave a blank for you to fill in.",
    inputLabel: "Course code",
    placeholder: "e.g. LIN4049",
    maxLength: 24,
    unknownLabel: "Not known yet — leave it blank",
    unknownDetail: "I will look it up later. The draft keeps an unfilled blank.",
    validationMessage: "Enter the course code, or choose \"Not known yet\"."
  },

  /*
    Teacher name is the second intake identifier. Whatever the student types
    is inserted verbatim into [Recipient title and surname] by
    applyTeacherName(); "unknown" keeps the visible blank. MailStone never
    infers a title or a surname from other data.
  */
  teacherName: {
    id: "teacherName",
    type: "text",
    tag: "RECIPIENT",
    title: "What is your teacher's name?",
    hint:
      "Use the form you would write in the email, for example \"Dr Chan\" or \"Professor Lau\". If you are not sure yet, choose \"Not clear yet\".",
    inputLabel: "Teacher's name",
    placeholder: "e.g. Dr Chan",
    maxLength: 60,
    unknownLabel: "Not clear yet — leave it blank",
    unknownDetail: "I will check the course outline. The draft keeps a blank for the recipient.",
    validationMessage: "Enter the teacher's name, or choose \"Not clear yet\"."
  },

  /*
    The lookup step does not guess or scrape a personal address. It shows the
    two identifiers the student just supplied, gives a copyable search phrase
    and links to EdUHK's official staff directory, then lets the student paste
    an address THEY found. That address is clearly labelled as student-found,
    never as an officially published office address.
  */
  teacherEmail: {
    id: "teacherEmail",
    type: "lookup",
    tag: "FIND THE ADDRESS",
    title: "Find your teacher's university email",
    hint:
      "Use the course code and teacher's name below to look up the address on the official EdUHK staff directory. MailStone will not guess it for you.",
    addressLabel: "Paste the address you found (optional)",
    placeholder: "name@eduhk.hk",
    unknownLabel: "Not clear yet — I will look it up later",
    unknownDetail: "Skip this step. The draft keeps a blank for the recipient.",
    validationMessage: "That does not look like an email address. Check it, or choose \"Not clear yet\"."
  },

  /*
    Relationship affects the greeting and self-introduction. A student who
    knows the teacher well can open more naturally; one who has had normal
    teaching contact but may not be remembered needs to identify themselves
    clearly. "Not sure" defaults to the safe self-introduction.
  */
  relationship: {
    id: "relationship",
    tag: "YOUR RELATIONSHIP",
    title: "How well do you know this teacher?",
    hint:
      "This affects the greeting and whether you need to introduce yourself. There is no wrong answer — it just helps the email sound natural.",
    options: [
      {
        value: "familiar",
        title: "I know them well",
        detail: "They would recognise my name. We have talked before."
      },
      {
        value: "taught",
        title: "Normal teaching — they may not remember me",
        detail: "I attended classes but we have not spoken much."
      },
      {
        value: "unknown",
        title: "I am not sure",
        detail: "I will introduce myself to be safe."
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
  violations: [],
  contacts: null
};
let gate = null;
let lint = { findings: [], placeholders: [], blocking: false };

/*
  Recipient confirmations are per-session UI state. They are not answers and
  are not persisted: toggling a box only decides what appears in the To: line
  on this page. Nothing is sent and no address is written into the draft body.
*/
const confirmedRecipients = new Set();

/*
  A teacher address the student found and pasted themselves is deliberately
  NOT a row in contacts.json: this synthetic id lets it share the same
  confirmation contract without pretending to be an officially published
  office address.
*/
const STUDENT_TEACHER_CONTACT_ID = "STUDENT-TEACHER-EMAIL";

/*
  UI-only state for the fixed-viewport shell. None of this is persisted,
  sent anywhere, or part of the answer set.
*/
let appStarted = false;
let initialView = null;
let lastShownDraft = null;
let uiScale = 1;

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

const welcomeScreen = document.querySelector("#welcome-screen");
const appShell = document.querySelector("#app-shell");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");

const mascotButton = document.querySelector("#mascot-button");
const mascotPanel = document.querySelector("#mascot-panel");
const mascotClose = document.querySelector("#mascot-close");

const selfCheckList = document.querySelector("#self-check-list");
const selfCheckStatus = document.querySelector("#self-check-status");
const checkAllButton = document.querySelector("#check-all-button");
const copyButton = document.querySelector("#copy-button");

/* ---------- Fixed-viewport shell: welcome, start, restart ---------- */

function startApp() {
  if (appStarted) {
    return;
  }

  appStarted = true;
  welcomeScreen.hidden = true;
  appShell.hidden = false;

  if (typeof initialView === "function") {
    initialView();
  } else {
    renderStep(false);
  }

  window.MailStoneI18n.sweep();
}

function restartApp() {
  Object.keys(answers).forEach(key => delete answers[key]);

  currentStep = 0;
  savedDraft = null;
  lastShownDraft = null;
  isReviewMode = false;
  gate = null;
  lint = { findings: [], placeholders: [], blocking: false };
  confirmedRecipients.clear();

  toggleReview.setAttribute("aria-pressed", "false");
  toggleReview.textContent = window.MailStoneI18n.t("Check this draft");
  draftEditor.hidden = false;
  draftPreview.hidden = true;
  reviewLegend.hidden = true;
  copyStatus.textContent = "";

  resetSelfCheck();
  setMascotPanel(false);
  utilityPanel.hidden = true;

  appStarted = false;
  initialView = null;
  appShell.hidden = true;
  welcomeScreen.hidden = false;

  window.MailStoneI18n.sweep();
  startButton.focus();
}

/* ---------- Gated self-check ---------- */

function selfCheckBoxes() {
  return [...selfCheckList.querySelectorAll('input[type="checkbox"]')];
}

function updateSelfCheck() {
  const i18n = window.MailStoneI18n;
  const boxes = selfCheckBoxes();
  const checked = boxes.filter(box => box.checked).length;
  const all = boxes.length > 0 && checked === boxes.length;

  copyButton.disabled = !all;
  selfCheckStatus.classList.toggle("is-unlocked", all);

  selfCheckStatus.textContent = all
    ? i18n.t("All checked — you can copy your draft now.")
    : i18n
        .t("{n} of {m} checked. Tick every item to unlock copying.")
        .replace("{n}", checked)
        .replace("{m}", boxes.length);

  checkAllButton.textContent = i18n.t(all ? "✓ Uncheck all" : "✓ Check all");
}

function resetSelfCheck() {
  selfCheckBoxes().forEach(box => {
    box.checked = false;
  });

  updateSelfCheck();
}

/* ---------- Mascot helper panel ---------- */

function setMascotPanel(open) {
  mascotPanel.hidden = !open;
  mascotButton.setAttribute("aria-expanded", String(open));
}

function setMascotTab(tabId) {
  mascotPanel.querySelectorAll(".mascot-tab").forEach(tab => {
    const active = tab.dataset.tab === tabId;

    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  mascotPanel.querySelectorAll(".mascot-tab-panel").forEach(panel => {
    panel.hidden = panel.dataset.tabPanel !== tabId;
  });
}

/*
  Attributes are invisible to a text-node walker. Placeholders therefore
  need their own refresh on a language change, using an explicit English
  source string stored on the element.
*/
function refreshAttributeText() {
  const i18n = window.MailStoneI18n;

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    element.placeholder = i18n.t(element.dataset.i18nPlaceholder);
  });

  const contrast = document.querySelector("#contrast-toggle");
  const motion = document.querySelector("#motion-toggle");

  if (contrast) {
    contrast.textContent = i18n.t(
      document.body.classList.contains("high-contrast") ? "On" : "Off"
    );
  }

  if (motion) {
    motion.textContent = i18n.t(
      document.body.classList.contains("reduce-motion") ? "On" : "Off"
    );
  }
}

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

  progressStepText.textContent = window.MailStoneI18n
    .t("Step {n} of 3")
    .replace("{n}", activeStage);
}

/* ---------- Inline checkpoint ---------- */

function updateInlinePolicyCheckpoint() {
  const preview = window.MailStoneGatekeeper.preview(data.rules, answers, data);

  if (!preview) {
    inlinePolicy.hidden = true;
    return;
  }

  const i18n = window.MailStoneI18n;

  inlinePolicyTitle.textContent = i18n.t(preview.title);
  inlinePolicyText.textContent = i18n.t(preview.text);
  inlinePolicy.hidden = false;
}

/* ---------- Question rendering ---------- */

/*
  A text step collects an identifier the draft can insert verbatim. The
  "not known yet" radio is an explicit answer, not a skipped question: it
  stores the literal string "unknown", which the substitution functions read
  to decide whether to insert a real value or leave the blank in place.

  Leaving the blank rather than deleting it is deliberate. An empty gap in a
  subject line is easy to overlook; a highlighted [Course code] placeholder
  is shown in the review preview, counted in the copy prompt and covered by
  the sending checklist. V09 only warns when there is no identifier AND no
  placeholder at all, so the visible token is the safer failure mode.

  The same renderer serves courseCode and teacherName. Both are identifiers;
  only their labels, placeholders and validation messages differ. Static
  labels are left in English so the DOM sweep translates them; only
  attributes (placeholders) need an explicit t() because a text-node walker
  cannot reach attributes.
*/
function renderTextStep(step) {
  const wrap = document.createElement("div");
  wrap.className = "text-step";

  const label = document.createElement("label");
  label.className = "text-step-label";
  label.htmlFor = `${step.id}-input`;
  label.textContent = step.inputLabel;

  const input = document.createElement("input");
  input.id = `${step.id}-input`;
  input.className = "text-step-input";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  /* Placeholders are attributes, not text nodes, so the sweep cannot reach them. */
  input.placeholder = window.MailStoneI18n.t(step.placeholder);
  input.maxLength = step.maxLength || 60;

  const validation = document.createElement("p");
  validation.className = "text-step-validation";
  validation.textContent = step.validationMessage;

  const unknownChoice = document.createElement("label");
  unknownChoice.className = "choice text-step-unknown";

  const unknownRadio = document.createElement("input");
  unknownRadio.type = "radio";
  unknownRadio.name = step.id;
  unknownRadio.value = "unknown";

  const unknownCopy = document.createElement("span");
  unknownCopy.className = "choice-copy";

  const unknownTitle = document.createElement("span");
  unknownTitle.className = "choice-title";
  unknownTitle.id = `${step.id}-unknown-title`;
  unknownTitle.textContent = step.unknownLabel;

  const unknownDetail = document.createElement("span");
  unknownDetail.className = "choice-detail";
  unknownDetail.textContent = step.unknownDetail;

  unknownRadio.setAttribute("aria-labelledby", unknownTitle.id);

  const isUnknown = answers[step.id] === "unknown";
  const hasValue = Boolean(answers[step.id]) && !isUnknown;

  input.value = hasValue ? answers[step.id] : "";
  input.disabled = isUnknown;
  unknownRadio.checked = isUnknown;
  unknownChoice.classList.toggle("selected", isUnknown);
  validation.hidden = Boolean(answers[step.id]);

  function setAnswer(value) {
    if (answers[step.id] !== value) {
      savedDraft = null;
    }

    answers[step.id] = value;
    validation.hidden = Boolean(value);
    nextButton.disabled = !value;
  }

  input.addEventListener("input", () => {
    const value = input.value.trim();

    if (unknownRadio.checked) {
      unknownRadio.checked = false;
      unknownChoice.classList.remove("selected");
      input.disabled = false;
    }

    setAnswer(value);
  });

  unknownRadio.addEventListener("change", () => {
    unknownChoice.classList.add("selected");
    input.disabled = true;
    input.value = "";
    setAnswer("unknown");
  });

  unknownCopy.append(unknownTitle, unknownDetail);
  unknownChoice.append(unknownRadio, unknownCopy);
  wrap.append(label, input, validation, unknownChoice);
  choices.append(wrap);

  /* i18n sweep runs at the end of renderStep(), after the DOM is built. */
}

/*
  Guided lookup, not address guessing.

  EdUHK publishes a staff directory (EDUHK-STAFF-DIRECTORY-2026) with a
  searchable form for surname, other names, Chinese name and email. MailStone
  links to it, offers a copyable search phrase built from the two identifiers
  the student supplied, and lets the student paste back an address THEY found.
  A pasted address is labelled "found by you" and must be re-confirmed with a
  checkbox before it appears in the To: line — the same contract as a
  published office address, but with a different provenance label.
*/
function buildSearchPhrase() {
  const terms = [];

  if (answers.teacherName && answers.teacherName !== "unknown") {
    terms.push(`"${answers.teacherName}"`);
  }

  if (answers.courseCode && answers.courseCode !== "unknown") {
    terms.push(answers.courseCode);
  }

  terms.push("site:eduhk.hk");

  return terms.join(" ");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function renderLookupStep(step) {
  const i18n = window.MailStoneI18n;
  const wrap = document.createElement("div");
  wrap.className = "lookup-step";

  const summary = document.createElement("div");
  summary.className = "lookup-summary";

  const codeChip = document.createElement("span");
  codeChip.className = "lookup-chip";
  codeChip.textContent = i18n
    .t("Course: {value}")
    .replace(
      "{value}",
      answers.courseCode && answers.courseCode !== "unknown"
        ? answers.courseCode
        : i18n.t("not provided")
    );

  const nameChip = document.createElement("span");
  nameChip.className = "lookup-chip";
  nameChip.textContent = i18n
    .t("Teacher: {value}")
    .replace(
      "{value}",
      answers.teacherName && answers.teacherName !== "unknown"
        ? answers.teacherName
        : i18n.t("not provided")
    );

  summary.append(codeChip, nameChip);

  const copyRow = document.createElement("div");
  copyRow.className = "lookup-links";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "lookup-copy-button";
  copyButton.textContent = "Copy a search phrase";

  const copyStatus = document.createElement("span");
  copyStatus.className = "mascot-status";
  copyStatus.setAttribute("role", "status");

  copyButton.addEventListener("click", async () => {
    const phrase = buildSearchPhrase();

    try {
      await navigator.clipboard.writeText(phrase);
      copyStatus.textContent = i18n.t(
        "Search phrase copied. Paste it into a search engine."
      );
    } catch {
      copyStatus.textContent = i18n.t(
        "Could not copy automatically. Select the phrase and copy it manually."
      );
    }
  });

  copyRow.append(copyButton, copyStatus);

  const links = document.createElement("div");
  links.className = "lookup-links";

  const directorySource =
    (data.sources && data.sources["EDUHK-STAFF-DIRECTORY-2026"]) || {};
  const directoryUrl = directorySource.url || "https://www.eduhk.hk/en/directory";
  const directoryAltUrl =
    (directorySource.extract && directorySource.extract.alternative_url) ||
    "https://www.eduhk.hk/zhs/directory";

  [
    { label: "Official staff directory (English)", url: directoryUrl },
    { label: "Official staff directory (Simplified Chinese)", url: directoryAltUrl },
    { label: "University Contact Us", url: "https://www.eduhk.hk/en/contact-us" }
  ].forEach(item => {
    const link = document.createElement("a");
    link.className = "lookup-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = item.label;
    links.append(link);
  });

  const principle = document.createElement("p");
  principle.className = "lookup-principle";
  principle.textContent =
    "MailStone does not guess or store personal addresses. EdUHK publishes staff emails on its official directory and department pages. Find the address there, paste it below, and confirm it yourself before it goes into the To: line.";

  const addressLabel = document.createElement("label");
  addressLabel.className = "lookup-address-label";
  addressLabel.htmlFor = "teacher-email-input";
  addressLabel.textContent = step.addressLabel;

  const input = document.createElement("input");
  input.id = "teacher-email-input";
  input.className = "lookup-address-input";
  input.type = "email";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = i18n.t(step.placeholder);

  const validation = document.createElement("p");
  validation.className = "lookup-validation";
  validation.textContent = step.validationMessage;

  const unknownChoice = document.createElement("label");
  unknownChoice.className = "choice text-step-unknown";

  const unknownRadio = document.createElement("input");
  unknownRadio.type = "radio";
  unknownRadio.name = step.id;
  unknownRadio.value = "unknown";

  const unknownCopy = document.createElement("span");
  unknownCopy.className = "choice-copy";

  const unknownTitle = document.createElement("span");
  unknownTitle.className = "choice-title";
  unknownTitle.id = "teacher-email-unknown-title";
  unknownTitle.textContent = step.unknownLabel;

  const unknownDetail = document.createElement("span");
  unknownDetail.className = "choice-detail";
  unknownDetail.textContent = step.unknownDetail;

  unknownRadio.setAttribute("aria-labelledby", unknownTitle.id);
  unknownCopy.append(unknownTitle, unknownDetail);
  unknownChoice.append(unknownRadio, unknownCopy);

  const isUnknown = answers[step.id] === "unknown";
  const hasValue = Boolean(answers[step.id]) && !isUnknown;

  input.value = hasValue ? answers[step.id] : "";
  input.disabled = isUnknown;
  unknownRadio.checked = isUnknown;
  unknownChoice.classList.toggle("selected", isUnknown);
  validation.hidden = true;

  function setAnswer(value) {
    if (answers[step.id] !== value) {
      savedDraft = null;
    }

    answers[step.id] = value;
    nextButton.disabled = !value;
  }

  input.addEventListener("input", () => {
    const value = input.value.trim();

    if (unknownRadio.checked) {
      unknownRadio.checked = false;
      unknownChoice.classList.remove("selected");
      input.disabled = false;
    }

    const valid = !value || isValidEmail(value);
    validation.hidden = valid;
    setAnswer(valid ? value : "");
  });

  unknownRadio.addEventListener("change", () => {
    unknownChoice.classList.add("selected");
    input.disabled = true;
    input.value = "";
    validation.hidden = true;
    setAnswer("unknown");
  });

  wrap.append(
    summary,
    copyRow,
    links,
    principle,
    addressLabel,
    input,
    validation,
    unknownChoice
  );
  choices.append(wrap);
}

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

  /*
    Text steps (courseCode, teacherName) are identifiers rather than
    categories, so they render an input plus a "not known yet" escape instead
    of a radio list. The lookup step guides the student to the official staff
    directory instead of guessing an address. The rest of the step machinery
    is shared.
  */
  if (step.type === "text") {
    renderTextStep(step);
  } else if (step.type === "lookup") {
    renderLookupStep(step);
  } else {
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

        /* The routed contact changes with the request, so old ticks are stale. */
        confirmedRecipients.clear();
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
  }

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

  window.MailStoneI18n.sweep();

  if (moveFocus) {
    questionTitle.focus();
  }
}

/* ---------- Draft content ---------- */

/*
  The greeting and self-introduction adapt to the student's relationship
  with the teacher. A student who knows the teacher well can open with a
  warmer greeting and skip the full introduction. A student who has only
  had normal teaching contact should identify themselves clearly so the
  recipient can place them before reading the request.

  This is not a courtesy flourish — it is a functional part of academic
  email. A teacher who cannot identify the student cannot act on the
  request, and a request without context reads as presumptuous.
*/
function getSelfIntroduction() {
  const rel = answers.relationship;

  if (rel === "familiar") {
    return "";
  }

  const courseCode = answers.courseCode && answers.courseCode !== "unknown"
    ? answers.courseCode
    : "[Course code]";

  if (rel === "taught") {
    return `I am [Your name], a student in your ${courseCode} class.`;
  }

  /* "unknown" or not set: safe default with full self-introduction */
  return `I am [Your name], a student in your ${courseCode} class.`;
}

/*
  The opening line varies by tone and relationship. When the student knows
  the teacher well, a warm "I hope you are well" is natural. When they may
  not be remembered, the self-introduction comes before the pleasantry so
  the recipient has context.
*/
function getOpeningLine(contextLine) {
  const rel = answers.relationship;
  const intro = getSelfIntroduction();

  if (rel === "familiar") {
    return intro ? `${intro} ${contextLine}` : contextLine;
  }

  /* For "taught" and "unknown": introduce first, then the context */
  return intro ? `${intro}\n\n${contextLine}` : contextLine;
}

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

  const contextLines = {
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
    getOpeningLine(contextLines[answers.tone]),
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

  const contextLines = {
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
    getOpeningLine(contextLines[answers.tone]),
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

  const contextLines = {
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
    getOpeningLine(contextLines[requestType] || contextLines.unsure),
    getReasonText(),
    requests[requestType] || requests.unsure,
    getToneClosing(),
    "Kind regards,\n[Your name]\n[Student ID]"
  ];

  return paragraphs.filter(Boolean).join("\n\n");
}

/*
  The teacher's name is also an identifier the student supplied. It replaces
  the [Recipient title and surname] salutation slot verbatim. "unknown" keeps
  the visible blank, exactly like the course code: an invisible gap in the
  salutation is too easy to send by mistake.
*/
function applyTeacherName(text) {
  const name = answers.teacherName;

  if (!name || name === "unknown") {
    return text;
  }

  return text.replaceAll("[Recipient title and surname]", name);
}

/*
  A course code is an identifier the student supplied, not a value the tool
  inferred. It is substituted into every [Course code] slot at the last step
  so all three draft builders stay identical. "unknown" keeps the blank.
*/
function applyCourseCode(text) {
  const code = answers.courseCode;

  if (!code || code === "unknown") {
    return text;
  }

  return text.replaceAll("[Course code]", code);
}

function buildDraft() {
  /*
    When the Gatekeeper cannot place this student inside the collected
    regulations, the extension template must not run: its whole structure
    ("permission in advance", "would an extension of X be possible") encodes
    a clause that may not govern this programme. Fall back to the neutral
    enquiry, which asks which procedure applies instead of assuming one.
  */
  let draft;

  if (gate && gate.draftMode === "scope_gap") {
    draft = buildGeneralDraft();
  } else if (answers.requestType === "extension") {
    draft = buildExtensionDraft();
  } else {
    draft = buildGeneralDraft();
  }

  /* Both substitutions are verbatim inserts, never inferred values. */
  draft = applyTeacherName(draft);
  return applyCourseCode(draft);
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
    ? window.MailStoneI18n.t("The usual route may already be closed")
    : `${window.MailStoneI18n.t("Policy checkpoint")} — ${rule.authority.section}`;

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
    <p><strong>Original wording:</strong> <span data-verbatim>“${rule.authority.quote}”</span></p>
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
    dd.textContent = `${window.MailStoneI18n.t(
      entry.question
    )} — ${window.MailStoneI18n.t(entry.resolution)}`;

    wrap.append(dt, dd);
    list.append(wrap);
  });

  note.textContent =
    gate && gate.closedRoute
      ? "This is a support service, not a regulation, and it is not the route you were already on. The web page confirms that assignment deadline extensions are among the accommodations they can consider. Whether this can be arranged after a deadline has passed is the one question still open — ask, do not assume."
      : "This is a support service, not a regulation. It tells you who to ask, not what you will be given. The web page lists the accommodations they can consider.";

  panel.hidden = false;
}

/* ---------- Recipient confirmation ---------- */

/*
  Contact rows are built from data/policy/contacts.json. Two rules matter:

  1. An address is only ever shown when the registry carries a published one.
     For course lecturers, Faculty Deans, Programme Leaders and the SAppC
     secretary the regulations name a ROLE but print no address, so the row
     says "not published" and points the student to an official page. Guessing
     a personal address is exactly the failure mode this project exists to
     prevent.

  2. A listed address is a lead, not a verified destination. MailStone cannot
     check that the same person still holds the role today. Each row therefore
     has a checkbox that the student must tick; only confirmed addresses with
     a published email appear in the To: line.
*/
/* Raw level codes are not student-facing words; give them a translatable label. */
const RECIPIENT_LEVEL_LABELS = {
  course: "Course-level contact",
  programme: "Programme-level contact",
  faculty: "Faculty-level contact",
  central: "Central office",
  student: "Found by you"
};

function buildRecipientRow(contact, why) {
  const row = document.createElement("div");
  row.className = contact.email
    ? "recipient-row"
    : "recipient-row recipient-row--unpublished";

  const top = document.createElement("div");
  top.className = "recipient-row-top";

  const role = document.createElement("strong");
  role.className = "recipient-role";
  role.textContent = contact.role;

  const badge = document.createElement("span");
  badge.className = "recipient-badge";
  badge.textContent = contact.email
    ? RECIPIENT_LEVEL_LABELS[contact.level] || contact.level
    : "Not published — find it yourself";

  top.append(role, badge);

  const whyLine = document.createElement("p");
  whyLine.className = "recipient-why";
  whyLine.textContent = why;

  row.append(top, whyLine);

  if (contact.email) {
    const address = document.createElement("div");
    address.className = "recipient-address";

    const link = document.createElement("a");
    link.href = `mailto:${contact.email}`;
    link.textContent = contact.email;
    link.className = "recipient-email";

    address.append(link);

    if (contact.phone) {
      const phone = document.createElement("span");
      phone.className = "recipient-phone";
      phone.textContent = contact.phone;
      address.append(phone);
    }

    row.append(address);
  } else {
    const lookup = document.createElement("p");
    lookup.className = "recipient-lookup";
    lookup.textContent = contact.lookup_note || "";

    const link = document.createElement("a");
    link.className = "recipient-lookup-link";
    link.href = contact.lookup_url || contact.source_url || "#";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Where to look";

    row.append(lookup, link);
  }

  const source = document.createElement("p");
  source.className = "recipient-source";

  const sourceLabel = document.createElement("span");
  sourceLabel.textContent = "Source: ";

  const sourceLink = document.createElement("a");
  sourceLink.href = contact.source_url || "#";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener";
  sourceLink.textContent = (contact.source_ids || []).join(", ");

  const retrieved = document.createElement("span");
  const i18n = window.MailStoneI18n;
  const dateLabel = contact.retrieved_date || i18n.t("not recorded");

  /* Composite strings with a date cannot be dictionary keys, so translate here. */
  retrieved.textContent = ` · ${i18n.t("Retrieved")} ${dateLabel}`;

  source.append(sourceLabel, sourceLink, retrieved);
  row.append(source);

  const confirm = document.createElement("label");
  confirm.className = "recipient-confirm";

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = confirmedRecipients.has(contact.contact_id);

  const confirmText = document.createElement("span");
  confirmText.textContent = contact.email
    ? "I have checked this address on the official page"
    : "I have found and checked the address myself";

  box.addEventListener("change", () => {
    if (box.checked) {
      confirmedRecipients.add(contact.contact_id);
    } else {
      confirmedRecipients.delete(contact.contact_id);
    }

    renderRecipientTo();
  });

  confirm.append(box, confirmText);
  row.append(confirm);

  return row;
}

function renderRecipientTo() {
  const state = document.querySelector("#recipient-state");
  const toWrap = document.querySelector("#recipient-to");
  const toValue = document.querySelector("#recipient-to-value");
  const registry = data.contacts;

  const emails = [...confirmedRecipients]
    .map(id => {
      if (id === STUDENT_TEACHER_CONTACT_ID) {
        return answers.teacherEmail && answers.teacherEmail !== "unknown"
          ? answers.teacherEmail
          : null;
      }

      return registry && registry.contacts[id] && registry.contacts[id].email;
    })
    .filter(Boolean);

  if (emails.length) {
    toValue.textContent = emails.join(", ");
    toWrap.hidden = false;
    state.textContent = window.MailStoneI18n.t("Confirmed by you");
    state.dataset.confirmed = "true";
  } else {
    toWrap.hidden = true;
    state.textContent = window.MailStoneI18n.t("No recipient confirmed yet.");
    state.dataset.confirmed = "false";
  }

  const checklistBox = document.querySelector("#check-recipient");

  if (checklistBox) {
    checklistBox.checked = confirmedRecipients.size > 0;
  }

  updateSelfCheck();
}

/*
  A student-found address is rendered with the SAME confirmation contract as
  a published office address, but with a different provenance label. It never
  enters contacts.json and is never described as "officially published".
*/
function buildTeacherEmailRow() {
  const pseudo = {
    contact_id: STUDENT_TEACHER_CONTACT_ID,
    role: "Teacher's email (found by you)",
    level: "student",
    email: answers.teacherEmail,
    phone: null,
    source_ids: ["EDUHK-STAFF-DIRECTORY-2026"],
    source_url: "https://www.eduhk.hk/en/directory",
    retrieved_date: null,
    verification_status: "student_confirmed"
  };

  return buildRecipientRow(
    pseudo,
    "You entered this address in the lookup step. MailStone did not find or guess it — confirm it on the official page before sending."
  );
}

function renderRecipientPanel() {
  const panel = document.querySelector("#result-recipient");
  const list = document.querySelector("#recipient-list");
  const registry = data.contacts;

  if (!registry || !registry.contacts || !registry.route_bindings) {
    panel.hidden = true;
    return;
  }

  const level =
    gate && gate.primary && gate.primary.route
      ? gate.primary.route.recipient_level
      : null;

  const bindingKey = level || "fallback";
  const groups = [];

  if (registry.route_bindings[bindingKey]) {
    groups.push(registry.route_bindings[bindingKey]);
  }

  if (gate && gate.services && gate.services.length && registry.route_bindings.support) {
    groups.push(registry.route_bindings.support);
  }

  list.replaceChildren();

  const seen = new Set();

  /*
    A student-found teacher address is shown first, explicitly separated from
    the officially published office addresses below it by its "Found by you"
    badge and its own reason line.
  */
  if (answers.teacherEmail && answers.teacherEmail !== "unknown") {
    list.append(buildTeacherEmailRow());
  }

  groups.forEach(group => {
    (group.contacts || []).forEach(id => {
      const contact = registry.contacts[id];

      if (!contact || seen.has(id)) {
        return;
      }

      seen.add(id);

      /* A fallback office needs its own reason, not the named contact's. */
      const why =
        (group.contact_whys && group.contact_whys[id]) || group.why;

      list.append(buildRecipientRow(contact, why));
    });
  });

  renderRecipientTo();
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
    summary.textContent = window.MailStoneI18n.t("No checks triggered.");
    panel.dataset.state = "clear";
  } else {
    summary.textContent = window.MailStoneI18n
      .t("{a} to fix · {b} to check")
      .replace("{a}", blockCount)
      .replace("{b}", warnCount);
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

  /* Lint rows can be rebuilt on every keystroke, so translate after each. */
  window.MailStoneI18n.sweep(panel);
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
  toggleReview.textContent = isReviewMode
    ? window.MailStoneI18n.t("Back to editing")
    : window.MailStoneI18n.t("Check this draft");

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
    const i18n = window.MailStoneI18n;

    return {
      valid: false,
      message: `${i18n.t("Fix before copying:")} ${i18n.t(
        blocking[0].name
      )}. ${i18n.t(blocking[0].message)}`
    };
  }

  return { valid: true, message: "" };
}

function getPlaceholders(text) {
  return text.match(/\[[^\]]+\]/g) || [];
}

function showResult(skipFocus = false) {
  questionCard.hidden = true;
  resultCard.hidden = false;

  gate = window.MailStoneGatekeeper.decide(data.rules, answers, data);

  if (savedDraft === null) {
    savedDraft = buildDraft();
  }

  draftEditor.value = savedDraft;

  /*
    A genuinely new draft invalidates the self-check. A language change calls
    showResult(true) with the SAME draft, so the student's ticks survive.
  */
  if (draftEditor.value !== lastShownDraft) {
    resetSelfCheck();
  }

  lastShownDraft = draftEditor.value;

  renderRoute();
  renderResultPolicy();
  renderSupport();
  renderRecipientPanel();
  renderFacts();
  renderLearningTips();

  refreshLint();

  const i18n = window.MailStoneI18n;

  /* Controls whose labels are set outside a full render need a refresh. */
  toggleReview.textContent = isReviewMode
    ? i18n.t("Back to editing")
    : i18n.t("Check this draft");

  document.querySelector("#show-policy-source").textContent = i18n.t(
    document.querySelector("#result-policy-source").hidden
      ? "Show source information"
      : "Hide source information"
  );

  updateSelfCheck();

  currentStep = getSteps().length - 1;

  setProgress(100, "Ready for your review");
  updateStepNavigation(getSteps().length);
  animateCard(resultCard);

  /* The interface language is applied after every render, never before. */
  window.MailStoneI18n.sweep();

  if (!skipFocus) {
    document.querySelector("#result-title").focus();
  }
}

/*
  Re-render the current view after a language change. Answers and any manual
  edits to the draft are preserved: savedDraft is updated on every input, so
  showResult() restores it, and renderStep() rebuilds inputs from answers.
*/
function refreshUi() {
  if (!appStarted) {
    /* Only the welcome screen is visible; translate it and its attributes. */
    refreshAttributeText();
    window.MailStoneI18n.sweep();
    return;
  }

  if (resultCard.hidden === false) {
    showResult(true);
  } else {
    renderStep(false);
  }

  refreshAttributeText();
  copyStatus.textContent = "";
  window.MailStoneI18n.sweep();
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
  window.MailStoneI18n.sweep(utilityPanel);
}

/* ---------- Events ---------- */

/* Language switcher — interface only; the draft and quotes stay English. */
const languageSwitcher = document.querySelector("#language-switcher");

function markActiveLanguage(lang) {
  languageSwitcher.querySelectorAll(".language-button").forEach(button => {
    const active = button.dataset.lang === lang;

    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

languageSwitcher.addEventListener("click", event => {
  const button = event.target.closest(".language-button");

  if (!button) {
    return;
  }

  window.MailStoneI18n.setLanguage(button.dataset.lang);
});

window.MailStoneI18n.onChange(lang => {
  markActiveLanguage(lang);
  languageSwitcher.setAttribute(
    "aria-label",
    window.MailStoneI18n.t("Interface language")
  );
  refreshUi();
});

/* A demo can pin the interface language with ?lang=zh-Hant. No storage. */
const initialLang = new URLSearchParams(window.location.search).get("lang");

if (initialLang) {
  window.MailStoneI18n.setLanguage(initialLang, true);
}

markActiveLanguage(window.MailStoneI18n.getLanguage());

/* ---------- Welcome gate, restart, self-check, mascot, display ---------- */

startButton.addEventListener("click", startApp);
restartButton.addEventListener("click", restartApp);

checkAllButton.addEventListener("click", () => {
  const boxes = selfCheckBoxes();
  const allChecked = boxes.length > 0 && boxes.every(box => box.checked);

  boxes.forEach(box => {
    box.checked = !allChecked;
  });

  updateSelfCheck();
});

selfCheckList.addEventListener("change", event => {
  if (event.target.matches('input[type="checkbox"]')) {
    updateSelfCheck();
  }
});

mascotButton.addEventListener("click", () => {
  setMascotPanel(mascotPanel.hidden);
});

mascotClose.addEventListener("click", () => {
  setMascotPanel(false);
  mascotButton.focus();
});

mascotPanel.querySelectorAll(".mascot-tab").forEach(tab => {
  tab.addEventListener("click", () => setMascotTab(tab.dataset.tab));
});

document.querySelector("#feedback-copy").addEventListener("click", async () => {
  const i18n = window.MailStoneI18n;
  const field = document.querySelector("#feedback-text");
  const status = document.querySelector("#feedback-status");
  const text = field.value.trim();

  if (!text) {
    status.textContent = i18n.t("Write a short note first, then copy it.");
    return;
  }

  /*
    Send the feedback to the MailStone backend for the project team to review.
    The endpoint URL is configurable via window.MAILSTONE_FEEDBACK_URL so it
    can be changed without modifying app.js. If no endpoint is configured, or
    the request fails, fall back to clipboard-copy so the student's feedback
    is never lost.
  */
  const endpoint = window.MAILSTONE_FEEDBACK_URL || "";
  const payload = {
    text: text,
    timestamp: new Date().toISOString(),
    page: window.location.pathname
  };

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        status.textContent = i18n.t(
          "Feedback sent. Thank you — your note helps us improve MailStone."
        );
        field.value = "";
        return;
      }

      /* If the server returned an error, fall back to clipboard */
      status.textContent = i18n.t(
        "The server could not receive the feedback. Copying it instead."
      );
    } catch {
      /* Network error or endpoint unreachable — fall back to clipboard */
      status.textContent = i18n.t(
        "Could not reach the feedback server. Copying it instead."
      );
    }
  }

  /*
    Fallback: nothing leaves the page. The app only formats the note and
    copies it to the clipboard; the student chooses whether and where to
    send it. This is also the path when no backend endpoint is configured.
  */
  const message = `MailStone feedback\n\n${text}`;

  try {
    await navigator.clipboard.writeText(message);
    status.textContent = i18n.t(
      "Copied. Paste it into an email to your supervisor — the feedback server was not available."
    );
  } catch {
    status.textContent = i18n.t(
      "Automatic copying is unavailable. Select your note and copy it manually."
    );
  }
});

document.querySelectorAll(".display-button[data-size]").forEach(button => {
  button.addEventListener("click", () => {
    uiScale = Number(button.dataset.size);

    document.querySelectorAll(".display-button[data-size]").forEach(item => {
      item.classList.toggle("is-active", item === button);
    });

    document.documentElement.style.setProperty("--ui-scale", String(uiScale));
  });
});

function bindPressedToggle(button, className) {
  button.addEventListener("click", () => {
    const on = document.body.classList.toggle(className);

    button.setAttribute("aria-pressed", String(on));
    button.textContent = window.MailStoneI18n.t(on ? "On" : "Off");
  });
}

bindPressedToggle(document.querySelector("#contrast-toggle"), "high-contrast");
bindPressedToggle(document.querySelector("#motion-toggle"), "reduce-motion");

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

/* ---------- Notebook-edge tabs (result page) ---------- */

/*
  Each edge tab toggles its own panel. Clicking a different tab does NOT
  close the first one — the student can have multiple panels open for
  comparison. Clicking an open tab closes it.
*/
document.querySelectorAll(".edge-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const panelId = tab.getAttribute("aria-controls");
    const panel = document.querySelector(`#${panelId}`);

    if (!panel) {
      return;
    }

    const isOpen = tab.getAttribute("aria-expanded") === "true";

    tab.setAttribute("aria-expanded", String(!isOpen));
    panel.hidden = isOpen;
  });
});

document
  .querySelector("#show-policy-source")
  .addEventListener("click", event => {
    const source = document.querySelector("#result-policy-source");
    const button = event.currentTarget;

    const isHidden = source.hidden;

    source.hidden = !isHidden;
    button.textContent = isHidden
      ? window.MailStoneI18n.t("Hide source information")
      : window.MailStoneI18n.t("Show source information");
  });

toggleReview.addEventListener("click", updateReviewMode);

document.querySelector("#edit-answers").addEventListener("click", () => {
  const hasManualEdits = savedDraft !== null && savedDraft !== buildDraft();

  if (hasManualEdits) {
    const proceed = window.confirm(
      window.MailStoneI18n.t(
        "Changing your choices may replace your edited draft with a new template. Copy your edits first if you want to keep them. Continue?"
      )
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
  const boxes = selfCheckBoxes();

  /* Defence in depth: the button is also disabled until every box is ticked. */
  if (!boxes.length || !boxes.every(box => box.checked)) {
    copyStatus.textContent = window.MailStoneI18n.t(
      "Tick every self-check item before copying."
    );
    return;
  }

  refreshLint();

  const draftText = draftEditor.value;
  const validation = validateFactLock();

  if (!validation.valid) {
    copyStatus.textContent = validation.message;
    draftEditor.hidden = false;
    draftPreview.hidden = true;
    reviewLegend.hidden = true;
    isReviewMode = false;
    toggleReview.textContent = window.MailStoneI18n.t("Check this draft");
    draftEditor.focus();
    return;
  }

  const placeholders = getPlaceholders(draftText);
  const i18n = window.MailStoneI18n;

  let message = i18n.t("Draft copied.");

  if (placeholders.length > 0) {
    message += ` ${i18n
      .t("{n} placeholders still to replace.")
      .replace("{n}", placeholders.length)}`;
  }

  try {
    await navigator.clipboard.writeText(draftText);

    copyStatus.textContent = `${message} ${i18n.t(
      "Remember to check every detail before sending."
    )}`;
  } catch {
    draftEditor.hidden = false;
    draftPreview.hidden = true;
    reviewLegend.hidden = true;

    draftEditor.focus();
    draftEditor.select();

    copyStatus.textContent = i18n.t(
      "Automatic copying is unavailable. The draft is selected; press Command+C on Mac or Ctrl+C on Windows."
    );
  }
});

/* In a fixed viewport the page cannot scroll; just open the utility panel. */
document.querySelector("#journey-button").addEventListener("click", () => {
  openUtility("journey");
});

document.querySelector("#privacy-button").addEventListener("click", () => {
  openUtility("privacy");
});

/* "Help" and the mascot open the same helper, so there is one place to ask. */
document.querySelector("#help-button").addEventListener("click", () => {
  setMascotTab("faq");
  setMascotPanel(true);
});

document.querySelector("#close-utility").addEventListener("click", () => {
  utilityPanel.hidden = true;
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    utilityPanel.hidden = true;
    setMascotPanel(false);
  }
});

/* ---------- Start ---------- */

async function loadData() {
  const [policyResponse, sourceResponse, qualityResponse, contactsResponse] =
    await Promise.all([
      fetch("./data/policy/rules.eduhk.json"),
      fetch("./data/policy/sources.json"),
      fetch("./data/quality/violations.json"),
      fetch("./data/policy/contacts.json")
    ]);

  if (
    !policyResponse.ok ||
    !sourceResponse.ok ||
    !qualityResponse.ok ||
    !contactsResponse.ok
  ) {
    throw new Error("Policy data could not be loaded.");
  }

  const policy = await policyResponse.json();
  const sources = await sourceResponse.json();
  const quality = await qualityResponse.json();
  const contacts = await contactsResponse.json();

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
    violations: quality.violations,
    contacts: contacts
  };
}

function showDataError() {
  /*
    The error text lives inside the app shell, which is hidden behind the
    welcome gate. Reveal it so the message is actually visible.
  */
  welcomeScreen.hidden = true;
  appShell.hidden = false;
  appStarted = true;
  questionCard.hidden = false;
  resultCard.hidden = true;

  questionTitle.textContent = "The policy data did not load.";
  questionHint.textContent =
    "This page must be opened through a local server, not by double-clicking the file. In VS Code, right-click index.html and choose Open with Live Server.";
  choices.replaceChildren();
  nextButton.disabled = true;
  backButton.disabled = true;
  inlinePolicy.hidden = true;
  window.MailStoneI18n.sweep();
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
        courseCode: "LIN4049",
        relationship: "taught",
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
        courseCode: "LIN4049",
        relationship: "taught",
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
        courseCode: "LIN4049",
        relationship: "familiar",
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
        courseCode: "LIN4049",
        relationship: "taught",
        tone: "formal"
      },
      grade: {
        programme: "ug",
        requestType: "grade",
        timing: "before_deadline",
        goal: "understand",
        situation: "new",
        courseCode: "LIN4049",
        relationship: "taught",
        tone: "formal"
      },
      "extension-no-code": {
        programme: "ug",
        requestType: "extension",
        timing: "before_deadline",
        goal: "request",
        situation: "new",
        reason: "health",
        disclosure: "brief",
        time: "3",
        courseCode: "unknown",
        relationship: "taught",
        tone: "warm"
      },
      unsure: {
        programme: "ug",
        requestType: "unsure",
        goal: "unsure",
        situation: "new",
        reason: "omit",
        disclosure: "brief",
        courseCode: "LIN4049",
        relationship: "unknown",
        tone: "warm"
      }
    };

    if (preset && presets[preset]) {
      Object.assign(answers, presets[preset]);

      /* QA links bypass the welcome gate so a demo lands straight on a result. */
      initialView = () => showResult();
      startApp();
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
        timing: "before_deadline",
        courseCode: "LIN4049",
        teacherName: "Dr Chan",
        teacherEmail: "unknown",
        relationship: "taught"
      });

      currentStep = Math.min(step, getSteps().length - 1);
      initialView = () => renderStep(false);
      startApp();
      return;
    }

    /*
      Normal visit: the slogan is the first thing on screen. No question is
      rendered until the student presses Start (progressive disclosure).
    */
    initialView = () => renderStep(false);
    refreshAttributeText();
    window.MailStoneI18n.sweep();
  })
  .catch(showDataError);
