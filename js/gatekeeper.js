"use strict";

/*
  MailStone — Gatekeeper

  Deterministic policy selection. No model call, no similarity search.

  Why not vector retrieval: the corpus is a few dozen clauses, and every
  assertion shown to a student must be traceable to a clause number. Ranking
  by embedding similarity cannot guarantee that, and fails in exactly the
  way this project is meant to prevent — returning a clause that reads right
  but applies to a different programme, year, or procedure.

  The Gatekeeper answers four questions and nothing else:
    1. Is the corpus even the right corpus for this student's programme?
    2. Which clauses can speak to this request?
    3. Which one governs, and how confident may the interface be?
    4. Is the route the student is on actually open?

  Question 1 is checked first and can veto the other three. A clause quoted
  perfectly but applied to the wrong programme is still a wrong answer.
*/

window.MailStoneGatekeeper = (function () {
  const ASSERTION_RANK = { assert: 3, suggest: 2, withhold: 1 };

  function compare(fieldValue, op, expected) {
    switch (op) {
      case "equals":
        return fieldValue === expected;
      case "not_equals":
        return fieldValue !== expected;
      case "in":
        return Array.isArray(expected) && expected.includes(fieldValue);
      case "not_in":
        return Array.isArray(expected) && !expected.includes(fieldValue);
      case "is_true":
        return fieldValue === true;
      case "is_false":
        return fieldValue === false;
      default:
        return false;
    }
  }

  function matches(rule, answers) {
    if (!rule.request_types.includes(answers.requestType)) {
      return false;
    }

    const conditions = rule.applies_when || [];

    return conditions.every(condition =>
      compare(answers[condition.field], condition.op, condition.value)
    );
  }

  /* ---------- Scope ---------- */

  /*
    Scope lives on the source document, because applicability is a property
    of the document, not of the sentence. A rule may override it, but only
    when the document itself states the narrower scope.
  */
  function resolveScope(rule, sources) {
    if (rule.scope) {
      return rule.scope;
    }

    const source = sources && sources[rule.authority.source_id];

    return (source && source.scope) || null;
  }

  function scopeVerdict(scope, programme) {
    if (!scope || !scope.programme_levels || scope.programme_levels.length === 0) {
      return "undeclared";
    }

    if (!programme) {
      return "programme_unknown";
    }

    return scope.programme_levels.includes(programme)
      ? "in_scope"
      : "out_of_scope";
  }

  function coverageEntry(programme, context) {
    const table = (context && context.programmeCoverage) || [];

    return table.find(row => row.programme_level === programme) || null;
  }

  /* A rule with more conditions is more specific and wins. */
  function specificity(rule) {
    return (rule.applies_when || []).length;
  }

  function decide(rules, answers, context) {
    const sources = (context && context.sources) || {};
    const programme = answers.programme;

    const matched = rules.filter(rule => matches(rule, answers));

    const inScope = [];
    const blockedByScope = [];

    matched.forEach(rule => {
      const scope = resolveScope(rule, sources);
      const verdict = scopeVerdict(scope, programme);

      if (verdict === "in_scope") {
        inScope.push(rule);
      } else {
        blockedByScope.push({ rule, scope, verdict });
      }
    });

    inScope.sort((a, b) => specificity(b) - specificity(a));

    const primary = inScope[0] || null;
    const supporting = inScope.slice(1);

    /*
      The closed route is a derived rule: after the due date, GAR 9.6.1's
      "permission in advance" no longer describes anything the student can
      do. Detecting it changes what the draft is allowed to ask for.
    */
    const closedRoute = inScope.some(
      rule => rule.topic === "closed_route_after_deadline"
    );

    const needsPriorContact = inScope.some(
      rule => rule.topic === "grade_disagreement_first_step"
    );

    let coverage = "no_rule";

    if (primary) {
      coverage = "covered";
    } else if (!programme) {
      coverage = "programme_unknown";
    } else if (blockedByScope.length > 0) {
      coverage = "out_of_scope";
    }

    /*
      Nothing is asserted unless the clause is in scope and verified. The
      downgrade is deliberate: "suggest" wording is still an assertion about
      what the rules say.
    */
    const assertion =
      coverage === "covered" && primary
        ? primary.ui_assertion_level || "withhold"
        : "withhold";

    const programmeRow = programme ? coverageEntry(programme, context) : null;

    const services = ((context && context.services) || [])
      .filter(service => matches(service, answers))
      .filter(service => {
        const scope = resolveScope(service, sources);

        return scopeVerdict(scope, programme) === "in_scope";
      });

    return {
      programme,
      coverage,
      programmeRow,
      applicable: inScope,
      blockedByScope,
      primary,
      supporting,
      services,
      closedRoute,
      needsPriorContact,
      assertion,
      draftMode:
        coverage === "out_of_scope" || coverage === "programme_unknown"
          ? "scope_gap"
          : closedRoute
            ? "post_deadline"
            : "standard"
    };
  }

  /* Used by the inline checkpoint while the student is still answering. */
  function preview(rules, answers, context) {
    if (!answers.requestType) {
      return null;
    }

    const result = decide(rules, answers, context);

    if (result.coverage === "programme_unknown") {
      return {
        title: "One thing to check first",
        text:
          "EdUHK publishes different academic regulations for different programme types. MailStone asks which one you are on before quoting a clause.",
        level: "withhold"
      };
    }

    if (result.coverage === "out_of_scope") {
      const document =
        (result.programmeRow && result.programmeRow.governing_document) || "";

      return {
        title: "Your programme's regulations are not in this policy base",
        text: `A clause exists, but it belongs to a different programme. ${
          document ? `Your programme is governed by ${document}, which has not been collected yet.` : ""
        } MailStone will write a general enquiry rather than apply the wrong clause.`,
        level: "withhold"
      };
    }

    if (!result.primary) {
      return {
        title: "No verified rule matches this yet",
        text:
          "MailStone will help you write a general enquiry rather than guess the procedure.",
        level: "withhold"
      };
    }

    return {
      title: result.primary.plain.split(".")[0] + ".",
      text: result.closedRoute
        ? "The route you are on may already be closed. Check the details before writing."
        : result.primary.required_action,
      level: result.assertion
    };
  }

  return {
    decide,
    preview,
    matches,
    specificity,
    resolveScope,
    scopeVerdict
  };
})();
