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

console.log(`\n${passed} passed, ${failed} failed\n`);

process.exit(failed === 0 ? 0 : 1);
