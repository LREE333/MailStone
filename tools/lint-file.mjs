/*
  MailStone — lint a draft from the command line

  Runs the same checks the interface runs, against a plain text file, so a
  draft can be checked without opening a browser. Used to check the project's
  own correspondence: if the tool cannot pass its own rules, the rules are
  decoration.

  Usage:
    node tools/lint-file.mjs <file.txt> [requestType] [programme] [timing]

  Example:
    node tools/lint-file.mjs docs/email-bibi.txt admin ug before_deadline
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

loadModule("js/gatekeeper.js");
loadModule("js/lint.js");

const [file, requestType = "admin", programme = "ug", timing = "before_deadline", recipientLevel = "course"] =
  process.argv.slice(2);

if (!file) {
  console.error("usage: node tools/lint-file.mjs <file.txt> [requestType] [programme] [timing] [recipientLevel]");
  process.exit(2);
}

const text = readFileSync(file, "utf8");
const quality = JSON.parse(
  readFileSync(join(root, "data/quality/violations.json"), "utf8")
);

const answers = { requestType, programme, timing };
const gate = { coverage: "covered", closedRoute: timing === "after_deadline" };

const result = window.MailStoneLint.run(text, {
  violations: quality.violations,
  answers,
  gate,
  recipientLevel
});

console.log(`\nfile: ${file}`);
console.log(
  `context: requestType=${requestType} programme=${programme} timing=${timing} recipientLevel=${recipientLevel}`
);
console.log(`blocking: ${result.blocking}`);

const placeholders = result.placeholders
  .map(item => (typeof item === "string" ? item : item.text || item.match || "?"))
  .filter(Boolean);

console.log(
  `placeholders: ${placeholders.length}${placeholders.length ? " → " + placeholders.join(", ") : ""}`
);

if (result.findings.length === 0) {
  console.log("findings: none\n");
} else {
  console.log(`findings: ${result.findings.length}\n`);
  result.findings.forEach(finding => {
    console.log(`  [${finding.severity || "?"}] ${finding.id}`);
    if (finding.message) console.log(`      ${finding.message}`);
    if (finding.match) console.log(`      matched: ${finding.match}`);
  });
  console.log("");
}
