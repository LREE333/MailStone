"use strict";

/*
  MailStone — Draft lint

  Negative examples are not fed to a language model as "do not write this".
  Prohibitions are unreliable in generation and impossible to audit. Each
  negative example is compiled into a check instead, so a finding can be
  pointed at, argued with, and counted in the evaluation.

  Patterns are read from data/quality/violations.json so the catalogue stays
  the single source of truth. Structural checks live here because they need
  the student's answers and the selected rule.
*/

window.MailStoneLint = (function () {
  const MONTHS =
    "January|February|March|April|May|June|July|August|September|October|November|December";

  function catalogueEntry(catalogue, id) {
    return catalogue.find(item => item.violation_id === id) || null;
  }

  function patternsOf(catalogue, id) {
    const entry = catalogueEntry(catalogue, id);

    if (!entry) {
      return [];
    }

    const patterns = [];

    (entry.detect || []).forEach(check => {
      if (check.patterns) {
        patterns.push(...check.patterns);
      }

      if (check.count_patterns) {
        patterns.push(...check.count_patterns);
      }
    });

    return patterns;
  }

  function findAll(patterns, text, defaultFlags) {
    const ranges = [];

    patterns.forEach(source => {
      let regex;

      try {
        regex = new RegExp(source, defaultFlags || "gi");
      } catch (error) {
        return;
      }

      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          break;
        }

        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
    });

    return ranges;
  }

  function countMatches(patterns, text) {
    return findAll(patterns, text, "gi").length;
  }

  function sentences(text) {
    return text
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  /*
    Purpose markers only. "I am writing to ask X" states why the email exists;
    the request itself is the sentence that follows ("Could you ..."). Counting
    both made every draft that opens with a purpose sentence look like it
    contained two competing requests.
  */
  const REQUEST_MARKER =
    /\b(could you|would you|would it be possible|may i|might i|please (?:let me know|confirm|advise|provide)|i would like to ask|i would be grateful if)\b/i;

  /*
    A direct question to the recipient is a request, and a well-formed email
    can consist of nothing else: "Does this cover coursework deadlines?" is
    not vaguer than "Could you tell me whether this covers coursework
    deadlines?". Matching only the politeness markers flagged the second form
    as having no request at all.
  */
  const DIRECT_QUESTION =
    /^(?:does|do|is|are|was|were|can|could|would|will|should|may|might|have|has|am)\b[^?]*\?$/i;

  function requestSentences(text) {
    return sentences(text).filter(
      sentence =>
        REQUEST_MARKER.test(sentence) || DIRECT_QUESTION.test(sentence)
    );
  }

  function finding(catalogue, id, ranges, message) {
    const entry = catalogueEntry(catalogue, id);

    return {
      id,
      name: entry ? entry.name : id,
      severity: entry ? entry.severity : "warn",
      message: message || (entry ? entry.repair : ""),
      ranges: ranges || []
    };
  }

  function run(text, ctx) {
    const catalogue = (ctx && ctx.violations) || [];
    const answers = (ctx && ctx.answers) || {};
    const gate = (ctx && ctx.gate) || {};
    const findings = [];

    if (!text || !text.trim()) {
      return { findings: [], placeholders: [], blocking: false };
    }

    /* V01 — presumptive approval */
    const presumptive = findAll(
      patternsOf(catalogue, "V01_PRESUMPTIVE_APPROVAL"),
      text
    );

    if (presumptive.length) {
      findings.push(
        finding(
          catalogue,
          "V01_PRESUMPTIVE_APPROVAL",
          presumptive,
          "This says something has already been approved. Nothing has been approved yet."
        )
      );
    }

    /* V02 — unsupported evidence claim */
    const evidence = findAll(
      patternsOf(catalogue, "V02_UNSUPPORTED_EVIDENCE"),
      text
    );

    if (evidence.length) {
      findings.push(
        finding(
          catalogue,
          "V02_UNSUPPORTED_EVIDENCE",
          evidence,
          "Check that this document exists and is actually attached, or remove the reference."
        )
      );
    }

    /* V03 — misrouted request */
    if (gate.draftMode === "post_deadline") {
      const misrouted = findAll(
        [
          "\\b(?:request|requesting|ask for|asking for) an? extension\\b",
          "\\bwould an extension of\\b",
          "\\bplease (?:grant|extend)\\b"
        ],
        text
      );

      if (misrouted.length) {
        findings.push(
          finding(
            catalogue,
            "V03_MISROUTED_REQUEST",
            misrouted,
            "After the due date there is no 'permission in advance' to request. Ask what options remain instead."
          )
        );
      }
    }

    /* V04 — over-apologetic register */
    const apologyCount = countMatches(
      patternsOf(catalogue, "V04_OVER_APOLOGY"),
      text
    );
    const wordCount = text.trim().split(/\s+/).length;
    const apologyLimit = wordCount < 200 ? 2 : 3;

    if (apologyCount > apologyLimit) {
      findings.push(
        finding(
          catalogue,
          "V04_OVER_APOLOGY",
          findAll(patternsOf(catalogue, "V04_OVER_APOLOGY"), text),
          `${apologyCount} apology markers in ${wordCount} words. Keep one, at the point of the request.`
        )
      );
    }

    /* V05 — under-mitigated register */
    const bare = findAll(patternsOf(catalogue, "V05_UNDER_MITIGATED"), text);

    if (bare.length) {
      findings.push(
        finding(
          catalogue,
          "V05_UNDER_MITIGATED",
          bare,
          "Phrase the request as a question with a modal: 'Could you ...' / 'Would it be possible to ...'."
        )
      );
    }

    /* V06 — vague request */
    const requests = requestSentences(text);

    if (requests.length === 0) {
      findings.push(
        finding(
          catalogue,
          "V06_VAGUE_REQUEST",
          [],
          "No request sentence found. Name the action you are asking for."
        )
      );
    }

    /* V07 — unnecessary sensitive disclosure */
    const disclosure = findAll(
      patternsOf(catalogue, "V07_EXCESS_DISCLOSURE"),
      text
    );

    if (disclosure.length) {
      findings.push(
        finding(
          catalogue,
          "V07_EXCESS_DISCLOSURE",
          disclosure,
          "Describe the impact on your work, not the diagnosis. Disclosure cannot be undone once sent."
        )
      );
    }

    /* V08 — competing requests */
    if (requests.length > 1) {
      /*
        Reported as a question, not a verdict. Two request sentences are not
        two actions: a request stated generally and then specified is one
        action written well. The writer is the only one who can tell the
        difference, so the panel asks rather than asserts.
      */
      findings.push(
        finding(
          catalogue,
          "V08_MULTIPLE_REQUESTS",
          [],
          `${requests.length} request sentences. Are these one request stated generally and then specified, or different actions that belong in separate emails?`
        )
      );
    }

    /* V09 — missing identifiers */
    /*
      A course code identifies the request to a course-level recipient. It
      does nothing for a Faculty Dean deciding a review, a Programme Leader
      deciding leave, or a central office answering a procedural question —
      and warning about its absence in those emails trains the student to
      ignore the panel. The check therefore runs only when the Gatekeeper has
      routed the draft to a course-level contact.
    */
    const recipientLevel = (ctx && ctx.recipientLevel) || "course";

    if (recipientLevel === "course") {
      const hasCourseCode = /\b[A-Z]{2,4}\d{3,4}\b/.test(text);
      const hasCoursePlaceholder = /\[[^\]]*course[^\]]*\]/i.test(text);

      if (!hasCourseCode && !hasCoursePlaceholder) {
        findings.push(
          finding(
            catalogue,
            "V09_MISSING_IDENTIFIERS",
            [],
            "No course code found. A lecturer cannot act on an unidentified request."
          )
        );
      }
    }

    /* V10 — register mismatch */
    const register = findAll(
      patternsOf(catalogue, "V10_REGISTER_MISMATCH"),
      text
    );

    if (register.length) {
      findings.push(
        finding(
          catalogue,
          "V10_REGISTER_MISMATCH",
          register,
          "Use a title and surname in the salutation, and a closing that matches it."
        )
      );
    }

    /* V11 — premature escalation */
    const escalation = findAll(
      patternsOf(catalogue, "V11_PREMATURE_ESCALATION"),
      text
    );

    if (escalation.length) {
      const isFirstContact = answers.situation === "new";

      findings.push(
        finding(
          catalogue,
          "V11_PREMATURE_ESCALATION",
          escalation,
          isFirstContact
            ? "This is a first contact. A formal review is only available after you have raised the matter with the lecturer."
            : "Consider whether a formal mechanism is the right next step."
        )
      );
    }

    /* V12 — date-blind */
    const hasDate = new RegExp(
      `(\\d{1,2}\\s+(?:${MONTHS})|(?:${MONTHS})\\s+\\d{1,2}|\\d{1,2}\\/\\d{1,2}|\\[(?:original )?deadline\\]|\\[date\\])`,
      "i"
    ).test(text);

    const needsDate = ["extension", "absence", "grade"].includes(
      answers.requestType
    );

    if (needsDate && !hasDate) {
      findings.push(
        finding(
          catalogue,
          "V12_DEADLINE_BLIND",
          [],
          "No date found. Every route here is date-gated, so the recipient cannot check it against a deadline."
        )
      );
    }

    const placeholders = findAll(["\\[[^\\]]+\\]"], text, "g").map(match => ({
      start: match.start,
      end: match.end,
      text: match.text
    }));

    findings.sort(
      (a, b) =>
        ({ block: 0, warn: 1, info: 2 }[a.severity] || 3) -
        ({ block: 0, warn: 1, info: 2 }[b.severity] || 3)
    );

    return {
      findings,
      placeholders,
      blocking: findings.some(item => item.severity === "block")
    };
  }

  return { run };
})();
