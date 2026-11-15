/*
  MailStone — logic tests

  Runs the Gatekeeper and the draft lint without a browser, so behaviour can
  be checked after every data edit.

  Usage:  node tools/test.mjs
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const window = {};

function loadModule(relativePath) {
  const code = readFileSync(join(root, relativePath), "utf8");
  new Function("window", code)(window);
}

function loadJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

loadModule("js/gatekeeper.js");
loadModule("js/lint.js");

const policy = loadJson("data/policy/rules.eduhk.json");
const sources = loadJson("data/policy/sources.json");
const quality = loadJson("data/quality/violations.json");

const rules = policy.rules;
const violations = quality.violations;

const sourceById = {};
sources.sources.forEach(source => {
  sourceById[source.source_id] = source;
});

const context = {
  sources: sourceById,
  programmeCoverage: sources.programme_coverage,
  services: policy.support_services || []
};

const gatekeeper = window.MailStoneGatekeeper;
const lint = window.MailStoneLint;

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  pass  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function decide(answers) {
  return gatekeeper.decide(rules, answers, context);
}

function runLint(text, answers, gate) {
  return lint.run(text, { answers, gate, violations });
}

/* ---------- Gatekeeper: route selection ---------- */

console.log("\nGatekeeper");

{
  const gate = decide({ programme: "ug", requestType: "extension", timing: "before_deadline" });

  check(
    "pre-deadline extension selects 9.6.1",
    gate.primary && gate.primary.rule_id === "EDUHK-GAR-9.6.1",
    gate.primary && gate.primary.rule_id
  );
  check("pre-deadline route is open", gate.closedRoute === false);
  check("draft mode is standard", gate.draftMode === "standard");
}

{
  const gate = decide({ programme: "ug", requestType: "extension", timing: "after_deadline" });

  check(
    "post-deadline extension selects the derived rule",
    gate.primary && gate.primary.rule_id === "EDUHK-DERIVED-AFTER-DEADLINE",
    gate.primary && gate.primary.rule_id
  );
  check("post-deadline route is closed", gate.closedRoute === true);
  check("draft mode switches", gate.draftMode === "post_deadline");
  check(
    "derived rule is not asserted as fact",
    gate.assertion === "suggest",
    gate.assertion
  );
}

{
  const gate = decide({ programme: "ug", requestType: "grade", timing: "before_deadline" });

  check(
    "grade question starts at 9.2.1",
    gate.primary && gate.primary.rule_id === "EDUHK-GAR-9.2.1",
    gate.primary && gate.primary.rule_id
  );
  check("grade route flags prior contact", gate.needsPriorContact === true);
}

{
  const gate = decide({ programme: "ug", requestType: "absence", timing: "before_deadline" });

  check(
    "absence selects 13.1",
    gate.primary && gate.primary.rule_id === "EDUHK-GAR-13.1",
    gate.primary && gate.primary.rule_id
  );
}

{
  const gate = decide({ programme: "ug", requestType: "exam", timing: "after_deadline" });

  check(
    "exam has no central rule (documented gap)",
    gate.primary === null,
    gate.primary && gate.primary.rule_id
  );
  check("no rule means no assertion", gate.assertion === "withhold");
}

{
  const gate = decide({ programme: "ug", requestType: "review", timing: "after_deadline" });

  check(
    "review includes the 14 working day deadline",
    gate.applicable.some(rule => rule.rule_id === "EDUHK-GAR-9.2.3")
  );
  check(
    "review includes the SAppC route",
    gate.applicable.some(rule => rule.rule_id === "EDUHK-PROC-4.5")
  );
}

/* ---------- Scope: the clause must govern this student ---------- */

console.log("\nScope");

{
  const gate = decide({
    programme: "tpg",
    requestType: "extension",
    timing: "before_deadline"
  });

  check(
    "a taught master's student gets no borrowed clause",
    gate.primary === null,
    gate.primary && gate.primary.rule_id
  );
  check(
    "the scope gap is reported, not silently empty",
    gate.coverage === "out_of_scope",
    gate.coverage
  );
  check(
    "the blocked clause is still visible in the data",
    gate.blockedByScope.some(item => item.rule.rule_id === "EDUHK-GAR-9.6.1"),
    gate.blockedByScope.map(item => item.rule.rule_id).join(", ")
  );
  check(
    "a scope gap withholds the assertion",
    gate.assertion === "withhold",
    gate.assertion
  );
  check(
    "a scope gap switches the draft to a neutral enquiry",
    gate.draftMode === "scope_gap",
    gate.draftMode
  );
  check(
    "the governing document is named",
    gate.programmeRow &&
      gate.programmeRow.governing_document === "EDUHK-TPG-GAR",
    gate.programmeRow && gate.programmeRow.governing_document
  );
}

{
  const gate = decide({ requestType: "extension", timing: "before_deadline" });

  check(
    "an unstated programme asserts nothing",
    gate.coverage === "programme_unknown" && gate.assertion === "withhold",
    gate.coverage
  );
}

{
  const gate = decide({ programme: "rpg", requestType: "grade" });

  check(
    "research students are outside the corpus too",
    gate.coverage === "out_of_scope",
    gate.coverage
  );
}

{
  const gate = decide({
    programme: "pgde",
    requestType: "extension",
    timing: "after_deadline"
  });

  check(
    "PGDE is inside the collected corpus",
    gate.coverage === "covered",
    gate.coverage
  );
  check("and still gets the closed-route warning", gate.closedRoute === true);
}

{
  const gate = decide({
    programme: "ug",
    requestType: "exam",
    timing: "after_deadline"
  });

  check(
    "exam still has no central rule",
    gate.primary === null,
    gate.primary && gate.primary.rule_id
  );
  check(
    "but the SEN support route is offered",
    gate.services.length === 1 &&
      gate.services[0].service_id === "EDUHK-SEN-ROUTE",
    gate.services.map(service => service.service_id).join(", ")
  );
}

{
  const gate = decide({ programme: "tpg", requestType: "exam" });

  /*
    The scope of this service changed on 2026-11-01: the earlier entry came
    from a government transition directory that lists degree, sub-degree and
    certificate students, but the University's own SEN leaflet addresses
    "students with SEN" without restricting by programme. The primary source
    wins, so the route is now offered to every level — and the basis for that
    scope is flagged, because the leaflet does not state it in so many words.
  */
  const leaflet = sourceById["EDUHK-SAO-SEN-LEAFLET"];

  check(
    "the SEN route is offered to postgraduate students too",
    gate.services.length === 1 &&
      gate.services[0].service_id === "EDUHK-SEN-ROUTE",
    gate.services.map(service => service.service_id).join(", ")
  );

  check(
    "but the widened scope is flagged, not asserted",
    leaflet.scope.scope_basis !== "verbatim",
    leaflet.scope.scope_basis
  );

  check(
    "the leaflet does not claim to describe what accommodation covers",
    /does not describe|not state|does not state/i.test(leaflet.notes)
  );

  check(
    "the open questions are recorded rather than answered",
    Array.isArray(gate.services[0].open_questions) &&
      gate.services[0].open_questions.length >= 1,
    String((gate.services[0].open_questions || []).length)
  );

  check(
    "resolved questions are carried in the data",
    Array.isArray(gate.services[0].resolved_questions) &&
      gate.services[0].resolved_questions.length >= 2,
    String(((gate.services[0].resolved_questions || []).map(q => q.question).join("; ")))
  );

  check(
    "the one remaining open question is about retrospective application",
    gate.services[0].open_questions.some(q => {
      const text = typeof q === "string" ? q : (q.question || "");
      return /after a deadline|retrospective/i.test(text);
    }),
    (gate.services[0].open_questions || []).map(q => typeof q === "string" ? q : (q.question || "")).join("; ")
  );
}

{
  /*
    The withholding mechanism itself still has to work, independently of
    which documents happen to be in the corpus today.
  */
  const narrowRule = {
    rule_id: "TEST-NARROW",
    topic: "test",
    request_types: ["extension"],
    applies_when: [],
    scope: { programme_levels: ["ug"] },
    authority: { source_id: "EDUHK-SH-2026-GAR", section: "test", quote: "test" },
    ui_assertion_level: "assert"
  };

  const gate = gatekeeper.decide([narrowRule], { programme: "tpg", requestType: "extension" }, {
    sources: sourceById,
    programmeCoverage: sources.programme_coverage
  });

  check(
    "a rule outside the student's programme is withheld",
    gate.primary === null && gate.coverage === "out_of_scope",
    `${gate.coverage} / ${gate.primary && gate.primary.rule_id}`
  );
}

/* ---------- Lint: false positives found by using the tool on real email ---------- */

console.log("\nLint against real correspondence");

{
  /*
    A direct question to the recipient is a request. The original marker list
    only matched politeness formulas, so an email built from numbered
    questions — "Does this cover coursework deadlines?" — was reported as
    having no request at all.
  */
  const result = lint.run(
    "Dear Office,\n\nI am writing about the service.\n\n1. Does the service cover coursework deadlines?\n\n2. Are postgraduate students eligible?\n\nKind regards,\n[Your name]",
    { violations, answers: { requestType: "admin", programme: "ug" }, gate: { coverage: "covered" }, recipientLevel: "central" }
  );

  check(
    "a numbered question counts as a request",
    !result.findings.some(item => item.id === "V06_VAGUE_REQUEST"),
    result.findings.map(item => item.id).join(", ")
  );
}

{
  /*
    V09 asks for a course code. A course code identifies a request to a
    lecturer; it does nothing for a Faculty Dean deciding a review or a
    central office answering a procedural question, and warning about it in
    those emails teaches the student to ignore the panel.
  */
  const text =
    "Dear Dean,\n\nI am writing to ask what the review procedure is.\n\nKind regards,\n[Your name]";

  const asCourse = lint.run(text, {
    violations,
    answers: { requestType: "grade", programme: "ug" },
    gate: { coverage: "covered" },
    recipientLevel: "course"
  });

  const asFaculty = lint.run(text, {
    violations,
    answers: { requestType: "grade", programme: "ug" },
    gate: { coverage: "covered" },
    recipientLevel: "faculty"
  });

  check(
    "V09 fires when the recipient is the course lecturer",
    asCourse.findings.some(item => item.id === "V09_MISSING_IDENTIFIERS")
  );

  check(
    "V09 does not fire for a faculty-level recipient",
    !asFaculty.findings.some(item => item.id === "V09_MISSING_IDENTIFIERS"),
    asFaculty.findings.map(item => item.id).join(", ")
  );
}

{
  /*
    Known limitation, recorded as a test so it cannot be forgotten: V08 counts
    request sentences, not distinct asks. One enquiry with three numbered
    sub-questions is indistinguishable from three competing requests. Numbering
    is the mitigation in the email; the limitation belongs in the report.
  */
  const result = lint.run(
    "Dear Office,\n\n1. Does the service cover deadlines?\n\n2. Are postgraduates eligible?\n\nKind regards,\n[Your name]",
    { violations, answers: { requestType: "admin", programme: "ug" }, gate: { coverage: "covered" }, recipientLevel: "central" }
  );

  check(
    "V08 cannot tell sub-questions from competing requests",
    result.findings.some(item => item.id === "V08_MULTIPLE_REQUESTS"),
    "If this ever passes, V08 has been improved and the limitation note can go."
  );
}

/* ---------- Lint: known failure modes ---------- */

console.log("\nDraft lint");

{
  const answers = { programme: "ug", requestType: "extension", situation: "new" };
  const gate = decide(answers);
  const result = runLint(
    "Dear Dr Chan,\n\nThank you for granting me an extension until 12 November.\n\nKind regards,\n[Your name]",
    answers,
    gate
  );

  check(
    "V01 catches presumptive approval",
    result.findings.some(item => item.id === "V01_PRESUMPTIVE_APPROVAL")
  );
  check("presumptive approval blocks copying", result.blocking === true);
}

{
  const answers = { programme: "ug", requestType: "extension", timing: "after_deadline" };
  const gate = decide(answers);
  const result = runLint(
    "I am writing to request an extension for the essay due on 6 November.",
    answers,
    gate
  );

  check(
    "V03 catches a request routed to a closed path",
    result.findings.some(item => item.id === "V03_MISROUTED_REQUEST")
  );
}

{
  const answers = { programme: "ug", requestType: "extension" };
  const gate = decide(answers);
  const result = runLint(
    "I have been diagnosed with generalised anxiety disorder and my psychiatrist increased my medication.",
    answers,
    gate
  );

  check(
    "V07 catches clinical disclosure",
    result.findings.some(item => item.id === "V07_EXCESS_DISCLOSURE")
  );
}

{
  const answers = { programme: "ug", requestType: "extension" };
  const gate = decide(answers);
  const result = runLint("I need you to extend my deadline to next Friday.", answers, gate);

  check(
    "V05 catches an under-mitigated demand",
    result.findings.some(item => item.id === "V05_UNDER_MITIGATED")
  );
}

{
  const answers = { programme: "ug", requestType: "grade", situation: "new" };
  const gate = decide(answers);
  const result = runLint(
    "If I do not receive a reply within 7 days I will lodge a formal appeal with the Faculty Dean.",
    answers,
    gate
  );

  check(
    "V11 catches premature escalation",
    result.findings.some(item => item.id === "V11_PREMATURE_ESCALATION")
  );
}

{
  const answers = { programme: "ug", requestType: "extension" };
  const gate = decide(answers);
  const result = runLint(
    "Dear Dr Chan,\n\nI am writing about Essay 2 for LIN4049, which is due on Friday 6 November.\n\nI have been unwell for the past week. I am sorry to write at short notice.\n\nWould it be possible to have an extension of three days, to Monday 9 November?\n\nKind regards,\n[Your name]",
    answers,
    gate
  );

  check(
    "a well-formed draft has no blocking finding",
    result.blocking === false,
    result.findings.map(item => item.id).join(", ")
  );
  check(
    "placeholders are still reported",
    result.placeholders.length === 1,
    String(result.placeholders.length)
  );
  check(
    "V10 does not fire on 'Kind regards'",
    !result.findings.some(item => item.id === "V10_REGISTER_MISMATCH"),
    result.findings.map(item => item.id).join(", ")
  );
  check(
    "V12 accepts an unfilled date placeholder",
    !result.findings.some(item => item.id === "V12_DEADLINE_BLIND"),
    result.findings.map(item => item.id).join(", ")
  );
}

{
  const answers = { programme: "ug", requestType: "extension" };
  const gate = decide(answers);
  const result = runLint(
    "Dear Dr Chan,\n\nWould it be possible to have an extension of three days?\n\nRegards,\n[Your name]",
    answers,
    gate
  );

  check(
    "V10 catches a bare 'Regards' sign-off",
    result.findings.some(item => item.id === "V10_REGISTER_MISMATCH")
  );
}

{
  const answers = { programme: "ug", requestType: "extension" };
  const gate = decide(answers);
  const result = runLint(
    "Dear Dr Chan,\n\nWould it be possible to have an extension of three days?\n\nKind regards,\n[Your name]",
    answers,
    gate
  );

  check(
    "V12 fires when no date is given at all",
    result.findings.some(item => item.id === "V12_DEADLINE_BLIND")
  );
}

/* ---------- Data integrity ---------- */

console.log("\nPolicy data");

{
  const sources = loadJson("data/policy/sources.json");
  const knownIds = new Set(sources.sources.map(source => source.source_id));

  check(
    "every rule cites a registered source",
    rules.every(rule => knownIds.has(rule.authority.source_id)),
    rules
      .filter(rule => !knownIds.has(rule.authority.source_id))
      .map(rule => rule.rule_id)
      .join(", ")
  );

  check(
    "every rule carries a verbatim quote",
    rules.every(rule => rule.authority.quote && rule.authority.quote.length > 20)
  );

  check(
    "every rule declares a derivation type",
    rules.every(rule => ["verbatim", "inferred_from_clauses"].includes(rule.derivation))
  );

  const unverified = rules.filter(
    rule => rule.verification.status !== "verified_primary"
  );

  check(
    "unverified rules never use assert level",
    unverified.every(rule => rule.ui_assertion_level !== "assert"),
    unverified.map(rule => `${rule.rule_id}:${rule.ui_assertion_level}`).join(", ")
  );

  check(
    "rule ids are unique",
    new Set(rules.map(rule => rule.rule_id)).size === rules.length
  );

  /* ---- Scope integrity ---- */

  check(
    "every source declares a programme scope",
    sources.sources.every(
      source =>
        source.scope &&
        Array.isArray(source.scope.programme_levels) &&
        source.scope.programme_levels.length > 0
    ),
    sources.sources
      .filter(source => !source.scope || !source.scope.programme_levels.length)
      .map(source => source.source_id)
      .join(", ")
  );

  check(
    "every source states how its scope was established",
    sources.sources.every(source =>
      ["verbatim", "inferred_from_structure", "needs_confirmation"].includes(
        source.scope && source.scope.scope_basis
      )
    ),
    sources.sources
      .filter(
        source =>
          !source.scope ||
          !["verbatim", "inferred_from_structure", "needs_confirmation"].includes(
            source.scope.scope_basis
          )
      )
      .map(source => source.source_id)
      .join(", ")
  );

  check(
    "every rule resolves to a non-empty scope",
    rules.every(rule => {
      const scope = gatekeeper.resolveScope(rule, sourceById);
      return scope && scope.programme_levels && scope.programme_levels.length > 0;
    }),
    rules
      .filter(rule => {
        const scope = gatekeeper.resolveScope(rule, sourceById);
        return !scope || !scope.programme_levels || !scope.programme_levels.length;
      })
      .map(rule => rule.rule_id)
      .join(", ")
  );

  check(
    "no rule is cited from a document that has not been retrieved",
    rules.every(
      rule => sourceById[rule.authority.source_id].verification_status !== "identified_not_retrieved"
    ),
    rules
      .filter(
        rule =>
          sourceById[rule.authority.source_id].verification_status ===
          "identified_not_retrieved"
      )
      .map(rule => rule.rule_id)
      .join(", ")
  );

  check(
    "the coverage table only points at registered documents",
    sources.programme_coverage.every(row =>
      knownIds.has(row.governing_document)
    ),
    sources.programme_coverage
      .filter(row => !knownIds.has(row.governing_document))
      .map(row => row.programme_level)
      .join(", ")
  );

  check(
    "every programme level in the coverage table is offered by the UI",
    sources.programme_coverage.every(row =>
      ["sub_degree", "ug", "pgde", "tpg", "rpg"].includes(row.programme_level)
    )
  );

  /* ---------- Empty states are documented, not accidental ---------- */

  /*
    A request type with no matching clause is only acceptable if the corpus
    records WHY. Otherwise a future contributor cannot tell a deliberate
    finding from a clause somebody forgot to collect.
  */
  const REQUEST_TYPES = ["extension", "grade", "exam", "absence", "review", "unsure"];

  const documentedGaps = new Map();

  sources.known_gaps
    .filter(gap => gap.surfaces_as === "empty_state")
    .forEach(gap => {
      (gap.request_types || []).forEach(type => documentedGaps.set(type, gap));
    });

  check(
    "every empty-state gap names the request types it explains",
    sources.known_gaps
      .filter(gap => gap.surfaces_as === "empty_state")
      .every(gap => Array.isArray(gap.request_types) && gap.request_types.length > 0),
    sources.known_gaps
      .filter(gap => gap.surfaces_as === "empty_state")
      .filter(gap => !Array.isArray(gap.request_types) || !gap.request_types.length)
      .map(gap => gap.gap_id)
      .join(", ")
  );

  check(
    "every empty-state gap names request types the UI actually offers",
    sources.known_gaps
      .filter(gap => gap.surfaces_as === "empty_state")
      .every(gap => gap.request_types.every(type => REQUEST_TYPES.includes(type)))
  );

  check(
    "every request type either has a rule or a documented gap",
    REQUEST_TYPES.every(
      type =>
        rules.some(rule => rule.request_types.includes(type)) ||
        documentedGaps.has(type)
    ),
    REQUEST_TYPES.filter(
      type =>
        !rules.some(rule => rule.request_types.includes(type)) &&
        !documentedGaps.has(type)
    ).join(", ")
  );

  check(
    "the exam absence gap is the one the UI will surface",
    documentedGaps.get("exam") &&
      documentedGaps.get("exam").gap_id === "GAP-EXAM-ABSENCE",
    documentedGaps.get("exam") ? documentedGaps.get("exam").gap_id : "none"
  );

  check(
    "a documented gap carries student-facing wording, not a code",
    sources.known_gaps
      .filter(gap => gap.surfaces_as === "empty_state")
      .every(
        gap =>
          typeof gap.student_facing_summary === "string" &&
          gap.student_facing_summary.length > 60
      )
  );
}

/* ---------- Recipient registry (office addresses, never guessed) ---------- */

console.log("\nRecipient registry");

{
  const contacts = loadJson("data/policy/contacts.json");
  const sourceText = readFileSync(join(root, "data/policy/sources.json"), "utf8");
  const registered = new Set(sources.sources.map(item => item.source_id));
  const entries = Object.values(contacts.contacts);

  check(
    "the registry states that it does not guess personal addresses",
    /does not guess personal email addresses/.test(contacts.principle)
  );

  check(
    "the registry states the student-confirmation contract",
    /checkbox/.test(contacts.confirmation_contract) &&
      /To: line/.test(contacts.confirmation_contract)
  );

  check(
    "every contact cites only registered sources",
    entries.every(contact =>
      (contact.source_ids || []).every(id => registered.has(id))
    ),
    entries
      .flatMap(contact => (contact.source_ids || []).filter(id => !registered.has(id)))
      .join(", ")
  );

  check(
    "every published address appears verbatim in a registered source",
    entries
      .filter(contact => contact.email)
      .every(contact => sourceText.includes(contact.email)),
    entries
      .filter(contact => contact.email && !sourceText.includes(contact.email))
      .map(contact => contact.email)
      .join(", ")
  );

  check(
    "every published address uses the official eduhk.hk domain",
    entries
      .filter(contact => contact.email)
      .every(contact => /@eduhk\.hk$/.test(contact.email)),
    entries
      .filter(contact => contact.email && !/@eduhk\.hk$/.test(contact.email))
      .map(contact => contact.email)
      .join(", ")
  );

  check(
    "role-only contacts carry email: null, never an invented address",
    entries
      .filter(contact => contact.verification_status === "unpublished_in_corpus")
      .every(contact => contact.email === null)
  );

  check(
    "unpublished role contacts give the student a lookup URL and a note",
    entries
      .filter(contact => !contact.email)
      .every(contact => contact.lookup_url && contact.lookup_note)
  );

  check(
    "every contact records a source URL, retrieval date and status",
    entries.every(
      contact =>
        contact.source_url && contact.retrieved_date && contact.verification_status
    )
  );

  check(
    "every route binding points at a real contact",
    Object.values(contacts.route_bindings).every(group =>
      (group.contacts || []).every(id => contacts.contacts[id])
    )
  );

  check(
    "per-contact reasons only describe contacts bound in that group",
    Object.values(contacts.route_bindings).every(group =>
      Object.keys(group.contact_whys || {}).every(id =>
        (group.contacts || []).includes(id)
      )
    )
  );

  const levels = new Set(
    rules.map(rule => rule.route && rule.route.recipient_level).filter(Boolean)
  );

  check(
    "every recipient_level used by a rule has a route binding",
    [...levels].every(level => contacts.route_bindings[level]),
    [...levels].filter(level => !contacts.route_bindings[level]).join(", ")
  );

  check(
    "the support route binds the verified SEN office address",
    contacts.route_bindings.support.contacts.includes("EDUHK-SEN-SUPPORT") &&
      contacts.contacts["EDUHK-SEN-SUPPORT"].email === "saosen@eduhk.hk"
  );

  check(
    "the University Contact Us page is registered as a source",
    registered.has("EDUHK-CONTACT-US-2026")
  );
}

/* ---------- Course code step and substitution ---------- */

console.log("\nCourse code");

{
  const appSource = readFileSync(join(root, "js/app.js"), "utf8");

  /*
    Pull the real function out of app.js and run it in isolation. This tests
    the code that actually ships, rather than a copy that could drift.
    applyCourseCode has no braces inside strings, so brace matching is safe.
  */
  function extractFunction(code, name) {
    const marker = `function ${name}(`;
    const start = code.indexOf(marker);

    if (start === -1) {
      return null;
    }

    let depth = 0;

    for (let index = start; index < code.length; index += 1) {
      if (code[index] === "{") {
        depth += 1;
      } else if (code[index] === "}") {
        depth -= 1;

        if (depth === 0) {
          return code.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  const functionSource = extractFunction(appSource, "applyCourseCode");

  check("applyCourseCode exists in app.js", Boolean(functionSource));

  const makeApply = new Function(
    "answers",
    `${functionSource}\nreturn applyCourseCode;`
  );

  const withCode = makeApply({ courseCode: "LIN4049" })(
    "Subject: [Course code] — about [Course code]"
  );
  const unknown = makeApply({ courseCode: "unknown" })(
    "Subject: [Course code]"
  );
  const missing = makeApply({})("Subject: [Course code]");

  check(
    "a supplied code replaces every [Course code] slot",
    withCode === "Subject: LIN4049 — about LIN4049",
    withCode
  );

  check(
    "the supplied code is inserted verbatim, not normalised or inferred",
    makeApply({ courseCode: "ABC-1234" })("Subject: [Course code]") ===
      "Subject: ABC-1234"
  );

  check(
    "'not known yet' keeps the visible placeholder",
    unknown === "Subject: [Course code]",
    unknown
  );

  check(
    "a missing answer also keeps the visible placeholder",
    missing === "Subject: [Course code]",
    missing
  );

  check(
    "buildDraft applies the course code as its final step",
    /return applyCourseCode\(draft\);/.test(appSource)
  );

  check(
    "courseCode is a free-text step, not a radio category",
    /courseCode: \{[\s\S]*?type: "text"/.test(appSource)
  );

  const seqBlock = appSource.slice(
    appSource.indexOf("const SEQUENCES"),
    appSource.indexOf("const CAPTIONS")
  );
  const seqEntries = [...seqBlock.matchAll(/(\w+):\s*\[([^\]]*)\]/g)];

  check("all six request-type sequences are present", seqEntries.length === 6);

  check(
    "every sequence asks for the course code",
    seqEntries.every(match => match[2].includes("courseCode")),
    seqEntries
      .filter(match => !match[2].includes("courseCode"))
      .map(match => match[1])
      .join(", ")
  );

  check(
    "the 'not known yet' option stores the literal string unknown",
    /unknownRadio.value = "unknown"/.test(appSource) &&
      /setAnswer\("unknown"\)/.test(appSource)
  );

  /* The visible placeholder must still be caught by the review tooling. */
  const placeholderText = "Subject: [Course code]";
  const realCodeText = "Subject: LIN4049";
  const options = {
    violations,
    answers: { requestType: "extension", programme: "ug" },
    gate: { coverage: "covered" },
    recipientLevel: "course"
  };

  const asPlaceholder = lint.run(placeholderText, options);
  const asRealCode = lint.run(realCodeText, options);

  check(
    "an unfilled [Course code] blank is reported as a placeholder",
    asPlaceholder.placeholders.some(item => /course/i.test(item.text || item.match || "")),
    JSON.stringify(asPlaceholder.placeholders)
  );

  check(
    "a real course code is not reported as an unfilled placeholder",
    !asRealCode.placeholders.some(item => /course/i.test(item.text || item.match || ""))
  );
}

/* ---------- Interface localisation (EN / 繁 / 简) ---------- */

console.log("\nInterface localisation");

{
  const html = readFileSync(join(root, "index.html"), "utf8");
  const appSource = readFileSync(join(root, "js/app.js"), "utf8");
  const i18nSource = readFileSync(join(root, "js/i18n.js"), "utf8");

  const windowStub = {};
  let textNodes = [];

  const NodeFilterStub = {
    SHOW_TEXT: 4,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2
  };

  const documentStub = {
    documentElement: { lang: "en" },
    title: "MailStone — A clearer academic message",
    body: {},
    createTreeWalker(target, whatToShow, filter) {
      let index = 0;

      return {
        nextNode() {
          while (index < textNodes.length) {
            const node = textNodes[index];
            index += 1;

            if (filter.acceptNode(node) === NodeFilterStub.FILTER_ACCEPT) {
              return node;
            }
          }

          return null;
        }
      };
    }
  };

  new Function("window", "document", "NodeFilter", i18nSource)(
    windowStub,
    documentStub,
    NodeFilterStub
  );

  const i18n = windowStub.MailStoneI18n;

  check(
    "the i18n module exposes t, sweep, setLanguage and getLanguage",
    ["t", "sweep", "setLanguage", "getLanguage", "onChange"].every(
      key => typeof i18n[key] === "function"
    )
  );

  check(
    "exactly three interface languages are declared",
    i18n.LANGUAGES.length === 3 &&
      i18n.LANGUAGES.map(item => item.id).join(",") === "en,zh-Hant,zh-Hans"
  );

  check("English is the default interface language", i18n.getLanguage() === "en");

  check(
    "the translation dictionary is substantial",
    i18n.dictionarySize > 200,
    String(i18n.dictionarySize)
  );

  i18n.setLanguage("zh-Hant", true);

  check(
    "t() returns Traditional Chinese",
    i18n.t("What is the course code?") === "這門課的課程編號是甚麼？",
    i18n.t("What is the course code?")
  );

  check(
    "setLanguage updates the html lang attribute and document title",
    documentStub.documentElement.lang === "zh-Hant" &&
      documentStub.title === "MailStone — 讓學術訊息更清晰",
    `${documentStub.documentElement.lang} / ${documentStub.title}`
  );

  i18n.setLanguage("zh-Hans", true);

  check(
    "t() returns Simplified Chinese",
    i18n.t("What is the course code?") === "这门课的课程编号是什么？",
    i18n.t("What is the course code?")
  );

  i18n.setLanguage("en", true);

  check(
    "English t() is an identity function",
    i18n.t("Suggested recipient") === "Suggested recipient"
  );

  const criticalStrings = [
    "What is the course code?",
    "Not known yet — leave it blank",
    "Suggested recipient",
    "I have checked this address on the official page",
    "I have found and checked the address myself",
    "Interface language only — the email draft and quoted policy wording stay in English.",
    "Confirmed by you",
    "No recipient confirmed yet.",
    "Source:",
    "Retrieved:",
    "Not published — find it yourself",
    "Where to look",
    "Course-level contact",
    "Adding the course code",
    "A University-wide office that can direct you to the right unit if you cannot find the named contact's address."
  ];

  i18n.setLanguage("zh-Hant", true);

  check(
    "all critical new-feature strings are translated into Traditional Chinese",
    criticalStrings.every(text => i18n.t(text) !== text),
    criticalStrings.filter(text => i18n.t(text) === text).join(" | ")
  );

  i18n.setLanguage("zh-Hans", true);

  check(
    "all critical new-feature strings are translated into Simplified Chinese",
    criticalStrings.every(text => i18n.t(text) !== text),
    criticalStrings.filter(text => i18n.t(text) === text).join(" | ")
  );

  /* Minimal DOM stub: enough to prove sweep() honours its exclusions. */
  function el(tagName, attributes, parentElement) {
    return {
      tagName,
      parentElement: parentElement || null,
      hasAttribute(name) {
        return (attributes || []).includes(name);
      }
    };
  }

  function txt(nodeValue, parentElement) {
    return { nodeValue, parentElement: parentElement || null };
  }

  const plain = txt("Suggested recipient", el("H3", [], el("SECTION")));
  const noI18n = txt("Subject: [Course code]", el("DIV", ["data-no-i18n"]));
  const verbatim = txt("“a verbatim quote”", el("SPAN", ["data-verbatim"]));
  const script = txt("var x = 1;", el("SCRIPT"));
  const textarea = txt("Dear [Recipient]", el("TEXTAREA"));
  const unknownString = txt("An untranslated label", el("SPAN"));

  textNodes = [plain, noI18n, verbatim, script, textarea, unknownString];

  i18n.setLanguage("zh-Hant", true);
  i18n.sweep();

  check(
    "sweep translates an ordinary text node",
    plain.nodeValue === "建議收件人",
    plain.nodeValue
  );

  check(
    "sweep leaves data-no-i18n content (the email draft) in English",
    noI18n.nodeValue === "Subject: [Course code]",
    noI18n.nodeValue
  );

  check(
    "sweep leaves data-verbatim policy quotes in English",
    verbatim.nodeValue === "“a verbatim quote”",
    verbatim.nodeValue
  );

  check("sweep skips SCRIPT text", script.nodeValue === "var x = 1;");
  check("sweep skips TEXTAREA text", textarea.nodeValue === "Dear [Recipient]");

  check(
    "sweep leaves unknown strings unchanged rather than corrupting them",
    unknownString.nodeValue === "An untranslated label"
  );

  i18n.setLanguage("zh-Hans", true);
  i18n.sweep();

  check(
    "sweep switches an existing node to Simplified Chinese",
    plain.nodeValue === "建议收件人",
    plain.nodeValue
  );

  i18n.setLanguage("en", true);
  i18n.sweep();

  check(
    "sweep restores the exact original English, not a translation of a translation",
    plain.nodeValue === "Suggested recipient",
    plain.nodeValue
  );

  check(
    "restoring English still does not touch protected nodes",
    noI18n.nodeValue === "Subject: [Course code]" &&
      verbatim.nodeValue === "“a verbatim quote”"
  );

  /* Static guarantees about the English-only boundary. */
  check(
    "the draft textarea is excluded from interface translation",
    /id="email-draft"[\s\S]{0,300}?data-no-i18n/.test(html)
  );

  check(
    "the review preview is excluded from interface translation",
    /id="draft-preview"[\s\S]{0,300}?data-no-i18n/.test(html)
  );

  check(
    "the header declares all three language buttons",
    /data-lang="en"/.test(html) &&
      /data-lang="zh-Hant"/.test(html) &&
      /data-lang="zh-Hans"/.test(html)
  );

  check(
    "the English-only boundary is stated on the result page",
    /class="english-only-note"/.test(html) &&
      /stay in English/.test(html)
  );

  check(
    "verbatim policy quotes are marked as non-translatable in app.js",
    /data-verbatim/.test(appSource)
  );

  check(
    "app.js loads contacts.json alongside the other data files",
    /fetch\("\.\/data\/policy\/contacts\.json"\)/.test(appSource)
  );

  /* ---------- Coverage: every visible UI string needs 繁 / 简 ---------- */

  /*
    This is the executable form of the i18n gap audit. It collects:
      - every literal passed to t() in app.js,
      - every static text node in index.html (skipping script/style/textarea/
        noscript and anything under data-no-i18n or data-verbatim),
      - every data-i18n-placeholder attribute,
      - a curated list of strings built dynamically in app.js that the two
        static passes cannot see (STEP_DEFS, captions, lookup labels, etc.).
    Anything that is neither intentionally English nor in the dictionary
    fails the build, so new copy cannot appear in English in a Chinese
    session. The English draft and verbatim quotes remain excluded by the
    data-no-i18n / data-verbatim boundaries checked above.
  */
  const candidates = new Set();

  for (const match of appSource.matchAll(
    /\bt\(\s*(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g
  )) {
    candidates.add(match[1].slice(1, -1).replace(/\\n/g, " "));
  }

  for (const match of html.matchAll(/data-i18n-placeholder="([^"]*)"/g)) {
    candidates.add(match[1]);
  }

  const skipTags = new Set([
    "SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "SYMBOL"
  ]);
  const voidTags = new Set([
    "META", "LINK", "BR", "INPUT", "IMG", "HR", "SOURCE", "AREA",
    "BASE", "COL", "EMBED", "PARAM", "TRACK", "WBR", "USE", "PATH",
    "CIRCLE", "ELLIPSE", "RECT", "LINE", "POLYGON", "STOP"
  ]);

  const protectedStack = [];
  let skipDepth = 0;
  let buffer = "";
  let cursor = 0;

  function flushText() {
    if (buffer.trim()) {
      candidates.add(buffer);
    }
    buffer = "";
  }

  while (cursor < html.length) {
    if (html.startsWith("<!--", cursor)) {
      const end = html.indexOf("-->", cursor + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    if (html[cursor] === "<") {
      flushText();

      const close = html.indexOf(">", cursor);

      if (close === -1) {
        break;
      }

      const rawTag = html.slice(cursor + 1, close).trim();

      if (rawTag.startsWith("/")) {
        if (protectedStack.length) protectedStack.pop();
        if (skipDepth > 0) skipDepth -= 1;
      } else {
        const name = rawTag.split(/[\s/]/)[0].toUpperCase();
        const selfClosing = rawTag.endsWith("/") || voidTags.has(name);

        if (!selfClosing) {
          protectedStack.push(/data-no-i18n|data-verbatim/.test(rawTag));
          if (skipTags.has(name)) skipDepth += 1;
        }
      }

      cursor = close + 1;
      continue;
    }

    if (skipDepth === 0 && !protectedStack.some(Boolean)) {
      buffer += html[cursor];
    }

    cursor += 1;
  }

  flushText();

  /* Strings assembled at runtime that no static pass can reach. */
  const dynamicStrings = [
    "RECIPIENT", "FIND THE ADDRESS", "Naming your teacher", "Finding the address",
    "What is your teacher's name?", "Teacher's name", "e.g. Dr Chan",
    "Not clear yet — leave it blank",
    "I will check the course outline. The draft keeps a blank for the recipient.",
    "Enter the teacher's name, or choose \"Not clear yet\".",
    "Find your teacher's university email",
    "Paste the address you found (optional)",
    "Not clear yet — I will look it up later",
    "Skip this step. The draft keeps a blank for the recipient.",
    "That does not look like an email address. Check it, or choose \"Not clear yet\".",
    "Copy a search phrase", "Course: {value}", "Teacher: {value}",
    "not provided", "Official staff directory (English)",
    "Official staff directory (Simplified Chinese)", "University Contact Us",
    "MailStone does not guess or store personal addresses. EdUHK publishes staff emails on its official directory and department pages. Find the address there, paste it below, and confirm it yourself before it goes into the To: line.",
    "Found by you", "Teacher's email (found by you)",
    "You entered this address in the lookup step. MailStone did not find or guess it — confirm it on the official page before sending.",
    "All checked — you can copy your draft now.",
    "{n} of {m} checked. Tick every item to unlock copying.",
    "✓ Check all", "✓ Uncheck all", "Tick every self-check item before copying.",
    "Write a short note first, then copy it.",
    "Your feedback is sent directly to the MailStone team so we can improve the tool. If the server is unavailable, your note is copied to the clipboard instead so it is never lost.",
    "Send feedback",
    "Feedback sent. Thank you — your note helps us improve MailStone.",
    "The server could not receive the feedback. Copying it instead.",
    "Could not reach the feedback server. Copying it instead.",
    "Copied. Paste it into an email to your supervisor — the feedback server was not available.",
    "Automatic copying is unavailable. Select your note and copy it manually.",
    "On", "Off",
    "Use the course code and teacher's name below to look up the address on the official EdUHK staff directory. MailStone will not guess it for you.",
    "Use the form you would write in the email, for example \"Dr Chan\" or \"Professor Lau\". If you are not sure yet, choose \"Not clear yet\".",
    "How well do you know this teacher?",
    "This affects the greeting and whether you need to introduce yourself. There is no wrong answer — it just helps the email sound natural.",
    "I know them well",
    "They would recognise my name. We have talked before.",
    "Normal teaching — they may not remember me",
    "I attended classes but we have not spoken much.",
    "I am not sure",
    "I will introduce myself to be safe.",
    "Why this structure?",
    "Route",
    "Fact Lock"
  ];

  dynamicStrings.forEach(text => candidates.add(text));

  /* Icons, brand marks and non-language tokens stay English by design. */
  const intentionallyEnglish = new Set([
    "m.", "MailStone", "0%", "🔒", "✧", "→", "＋", "−", "!", "+", "?",
    "✓", "A−", "A", "A+", "EN", "繁", "简", "×"
  ]);

  const translatable = [...candidates]
    .map(text => text.replace(/\s+/g, " ").trim())
    .filter(
      text =>
        text.length >= 2 &&
        !intentionallyEnglish.has(text) &&
        /\p{L}/u.test(text)
    );

  const untranslated = translatable.filter(text => !i18n.has(text));

  check(
    "every visible UI string has Traditional and Simplified Chinese translations",
    untranslated.length === 0,
    `${translatable.length} strings checked; missing: ${untranslated.join(" | ")}`
  );

  check(
    "the redesign added a substantial new translation batch",
    i18n.dictionarySize > 560,
    String(i18n.dictionarySize)
  );

  check(
    "the i18n module exposes has() for coverage checks",
    typeof i18n.has === "function" && i18n.has("Tap Pebble for help") &&
      !i18n.has("This string is deliberately not in the dictionary")
  );
}

/* ---------- Relationship step and self-introduction ---------- */

console.log("\nRelationship and self-introduction");

{
  const appSource = readFileSync(join(root, "js/app.js"), "utf8");

  /*
    Extract a function from app.js source by brace matching.
    Reused from the course-code test above.
  */
  function extractFunction(code, name) {
    const marker = `function ${name}(`;
    const start = code.indexOf(marker);
    if (start === -1) { return null; }
    let depth = 0;
    for (let index = start; index < code.length; index += 1) {
      if (code[index] === "{") { depth += 1; }
      else if (code[index] === "}") {
        depth -= 1;
        if (depth === 0) { return code.slice(start, index + 1); }
      }
    }
    return null;
  }

  const getSelfIntroSrc = extractFunction(appSource, "getSelfIntroduction");
  const getOpeningSrc = extractFunction(appSource, "getOpeningLine");

  check("getSelfIntroduction exists in app.js", Boolean(getSelfIntroSrc));
  check("getOpeningLine exists in app.js", Boolean(getOpeningSrc));

  /*
    Build a runner that exposes both functions with a controllable answers
    object. The functions reference `answers` as a free variable, so we
    inject it as a parameter.
  */
  const makeRunner = new Function(
    "answers",
    `${getSelfIntroSrc}\n${getOpeningSrc}\nreturn { getSelfIntroduction, getOpeningLine };`
  );

  /* --- familiar: no self-introduction --- */
  const familiar = makeRunner({ relationship: "familiar", courseCode: "LIN4049" });
  check(
    "familiar relationship produces no self-introduction",
    familiar.getSelfIntroduction() === "",
    familiar.getSelfIntroduction()
  );
  check(
    "familiar opening line is just the context line",
    familiar.getOpeningLine("I am writing about Essay 2.") === "I am writing about Essay 2.",
    familiar.getOpeningLine("I am writing about Essay 2.")
  );

  /* --- taught: full self-introduction with course code --- */
  const taught = makeRunner({ relationship: "taught", courseCode: "LIN4049" });
  check(
    "taught relationship produces a self-introduction",
    taught.getSelfIntroduction().includes("I am [Your name]") &&
      taught.getSelfIntroduction().includes("LIN4049"),
    taught.getSelfIntroduction()
  );
  check(
    "taught opening line introduces before context",
    taught.getOpeningLine("I am writing about Essay 2.").includes("I am [Your name]") &&
      taught.getOpeningLine("I am writing about Essay 2.").includes("I am writing about Essay 2."),
    taught.getOpeningLine("I am writing about Essay 2.")
  );

  /* --- unknown: safe default with full self-introduction --- */
  const unknown = makeRunner({ relationship: "unknown", courseCode: "LIN4049" });
  check(
    "unknown relationship produces a self-introduction",
    unknown.getSelfIntroduction().includes("I am [Your name]"),
    unknown.getSelfIntroduction()
  );

  /* --- unknown course code: placeholder is preserved --- */
  const taughtNoCode = makeRunner({ relationship: "taught", courseCode: "unknown" });
  check(
    "taught with unknown course code keeps the placeholder",
    taughtNoCode.getSelfIntroduction().includes("[Course code]"),
    taughtNoCode.getSelfIntroduction()
  );

  /* --- missing course code: placeholder is preserved --- */
  const taughtMissingCode = makeRunner({ relationship: "taught" });
  check(
    "taught with missing course code keeps the placeholder",
    taughtMissingCode.getSelfIntroduction().includes("[Course code]"),
    taughtMissingCode.getSelfIntroduction()
  );

  /* --- relationship step is in every sequence --- */
  const seqBlock = appSource.slice(
    appSource.indexOf("const SEQUENCES"),
    appSource.indexOf("const CAPTIONS")
  );
  const seqEntries = [...seqBlock.matchAll(/(\w+):\s*\[([^\]]*)\]/g)];

  check(
    "every sequence includes the relationship step",
    seqEntries.every(match => match[2].includes("relationship")),
    seqEntries
      .filter(match => !match[2].includes("relationship"))
      .map(match => match[1])
      .join(", ")
  );

  /* --- STEP_DEF for relationship has three options --- */
  const relStepMatch = appSource.match(/relationship:\s*\{[\s\S]*?options:\s*\[([\s\S]*?)\]/);
  check(
    "relationship step has exactly three options",
    relStepMatch && (relStepMatch[1].match(/value:/g) || []).length === 3,
    String(relStepMatch ? (relStepMatch[1].match(/value:/g) || []).length : "no match")
  );

  check(
    "relationship options are familiar, taught, unknown",
    relStepMatch &&
      relStepMatch[1].includes('"familiar"') &&
      relStepMatch[1].includes('"taught"') &&
      relStepMatch[1].includes('"unknown"'),
    "missing one or more relationship values"
  );
}

/* ---------- Edge-tab panels (notebook-edge tabs) ---------- */

console.log("\nEdge-tab panels");

{
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "css/styles.css"), "utf8");
  const appSource = readFileSync(join(root, "js/app.js"), "utf8");

  check(
    "the result layout uses the new result-layout grid",
    /class="result-layout"/.test(html),
    "result-layout class not found in HTML"
  );

  check(
    "three edge-tab elements exist in HTML",
    (html.match(/class="edge-tab"/g) || []).length === 3,
    String((html.match(/class="edge-tab"/g) || []).length)
  );

  check(
    "edge-tab panels exist for route, facts, and structure",
    html.includes('id="panel-route"') &&
      html.includes('id="panel-facts"') &&
      html.includes('id="panel-structure"'),
    "one or more panel IDs missing"
  );

  check(
    "edge tabs use aria-controls for accessibility",
    /aria-controls="panel-route"/.test(html) &&
      /aria-controls="panel-facts"/.test(html) &&
      /aria-controls="panel-structure"/.test(html),
    "aria-controls not found on all edge tabs"
  );

  check(
    "edge tabs start with aria-expanded false",
    (html.match(/aria-expanded="false"/g) || []).length >= 3,
    "edge tabs should start collapsed"
  );

  check(
    "CSS defines vertical writing mode for edge tabs",
    /writing-mode:\s*vertical-rl/.test(css),
    "vertical writing mode not found in CSS"
  );

  check(
    "CSS defines edge-tab-panel positioning",
    /\.edge-tab-panel/.test(css) && /position:\s*absolute/.test(css),
    "edge-tab-panel CSS not found"
  );

  check(
    "app.js has edge-tab click handlers",
    /querySelectorAll\("\.edge-tab"\)/.test(appSource),
    "edge-tab click handler not found in app.js"
  );

  check(
    "edge-tab handler toggles aria-expanded",
    /setAttribute\("aria-expanded"/.test(appSource),
    "aria-expanded toggle not found in handler"
  );

  check(
    "edge-tab handler toggles panel hidden state",
    /panel\.hidden\s*=/.test(appSource),
    "panel.hidden toggle not found in handler"
  );
}

/* ---------- Feedback-to-backend handler ---------- */

console.log("\nFeedback handler");

{
  const appSource = readFileSync(join(root, "js/app.js"), "utf8");

  check(
    "app.js references MAILSTONE_FEEDBACK_URL",
    /MAILSTONE_FEEDBACK_URL/.test(appSource),
    "MAILSTONE_FEEDBACK_URL not found in app.js"
  );

  check(
    "feedback handler uses fetch with POST method",
    /fetch\([^)]+,\s*\{[\s\S]*?method:\s*"POST"/.test(appSource),
    "POST fetch not found in feedback handler"
  );

  check(
    "feedback handler sends JSON body",
    /JSON\.stringify\(/.test(appSource) && /body:\s*JSON/.test(appSource),
    "JSON body not found in feedback handler"
  );

  check(
    "feedback handler has clipboard fallback",
    /clipboard|navigator\.clipboard|execCommand\("copy"\)/.test(appSource),
    "clipboard fallback not found"
  );

  check(
    "feedback payload includes text and timestamp",
    /timestamp/.test(appSource) && /text/.test(appSource),
    "payload fields not found"
  );

  /* Check that the HTML has the updated feedback text */
  const html = readFileSync(join(root, "index.html"), "utf8");

  check(
    "HTML has the 'Send feedback' button label",
    /Send feedback/.test(html),
    "'Send feedback' label not found in HTML"
  );

  check(
    "HTML explains the backend-send behaviour",
    /sent directly to the MailStone team/.test(html),
    "backend-send explanation not found in HTML"
  );
}

/* ---------- Corpus: TOEFL exam-sample genre ---------- */

console.log("\nCorpus — TOEFL exam samples");

{
  const corpus = loadJson("data/exemplars/corpus.json");
  const exemplarsJson = loadJson("data/exemplars/exemplars.json");

  const toeflEntries = corpus.exemplars.filter(
    ex => ex.origin_class === "toefl_exam_sample"
  );

  check(
    "corpus has at least 2 TOEFL exam-sample entries",
    toeflEntries.length >= 2,
    String(toeflEntries.length)
  );

  check(
    "TOEFL entries are not counted in the academic exemplar total",
    corpus.status.exemplars_collected === 18 &&
      corpus.status.toefl_exam_samples >= 2,
    `academic: ${corpus.status.exemplars_collected}, toefl: ${corpus.status.toefl_exam_samples}`
  );

  check(
    "each TOEFL entry has an exam_context block",
    toeflEntries.every(ex => ex.exam_context && ex.exam_context.task_type === "Write an Email"),
    "one or more TOEFL entries missing exam_context"
  );

  check(
    "each TOEFL entry is labelled as prompted (not real correspondence)",
    toeflEntries.every(ex => ex.exam_context.prompted === true),
    "one or more TOEFL entries not labelled as prompted"
  );

  check(
    "the corpus has a genre note explaining why TOEFL samples are included",
    typeof corpus.toefl_exam_sample_genre_note === "object" &&
      typeof corpus.toefl_exam_sample_genre_note.pedagogical_use === "string",
    "genre note not found"
  );

  check(
    "exemplars.json registers the toefl_exam_sample provenance type",
    exemplarsJson.provenance_rules &&
      typeof exemplarsJson.provenance_rules.toefl_exam_sample === "string",
    "toefl_exam_sample not in provenance_rules"
  );

  /* The ETS official sample should have a source URL */
  const etsEntry = toeflEntries.find(ex => ex.exemplar_id === "EX-019");
  check(
    "EX-019 is the ETS official high-level sample",
    Boolean(etsEntry) && /ets\.org/.test(etsEntry.source_url || ""),
    etsEntry ? etsEntry.source_url : "EX-019 not found"
  );

  /* The Wofo entry should register the platform without a full-text email */
  const wofoEntry = toeflEntries.find(ex => ex.exemplar_id === "EX-021");
  check(
    "EX-021 registers the Wofo.cc platform as a consulted source",
    Boolean(wofoEntry) && /wofo\.cc/.test(wofoEntry.source_url || ""),
    wofoEntry ? wofoEntry.source_url : "EX-021 not found"
  );
}

/* ---------- Staff directory source registration ---------- */

console.log("\nStaff directory source");

{
  const sourcesData = loadJson("data/policy/sources.json");
  const contacts = loadJson("data/policy/contacts.json");
  const registered = new Set(sourcesData.sources.map(s => s.source_id));

  check(
    "EDUHK-STAFF-DIRECTORY-2026 is registered in sources.json",
    registered.has("EDUHK-STAFF-DIRECTORY-2026"),
    "source not registered"
  );

  const dirSource = sourcesData.sources.find(
    s => s.source_id === "EDUHK-STAFF-DIRECTORY-2026"
  );

  check(
    "staff directory source has the correct URL",
    dirSource && dirSource.url === "https://www.eduhk.hk/en/directory",
    dirSource ? dirSource.url : "source not found"
  );

  check(
    "staff directory source is verified_primary",
    dirSource && dirSource.verification_status === "verified_primary",
    dirSource ? dirSource.verification_status : "source not found"
  );

  /* Every role-only contact should now cite the staff directory */
  const roleOnly = Object.values(contacts.contacts).filter(
    c => c.verification_status === "unpublished_in_corpus"
  );

  check(
    "every role-only contact cites the staff directory source",
    roleOnly.every(c => (c.source_ids || []).includes("EDUHK-STAFF-DIRECTORY-2026")),
    roleOnly
      .filter(c => !(c.source_ids || []).includes("EDUHK-STAFF-DIRECTORY-2026"))
      .map(c => c.contact_id)
      .join(", ")
  );

  check(
    "every role-only contact points at the staff directory lookup_url",
    roleOnly.every(c => c.lookup_url === "https://www.eduhk.hk/en/directory"),
    roleOnly
      .filter(c => c.lookup_url !== "https://www.eduhk.hk/en/directory")
      .map(c => c.contact_id)
      .join(", ")
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);

process.exit(failed === 0 ? 0 : 1);
