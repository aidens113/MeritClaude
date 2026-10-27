// Tests for tools/working-docs-audit.mjs. The tool is a command, so every test
// builds a temporary repository on disk and runs it as a child process: that
// covers argument handling, file discovery, the printed findings, and the exit
// code exactly as a caller sees them.
//
// Run with: node --test tests/working-docs-audit.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("../tools/working-docs-audit.mjs", import.meta.url));

const DOC = "docs/working/example-plan.md";

const HEADER = [
  "# Example Plan",
  "",
  "Status: Active",
  "Status detail: In progress",
  "Created: 2026-01-01",
  "Last updated: 2026-01-02",
  "Owner: supervisor",
  "Scope: the example",
  "Paired document: none",
  "Related: none"
];

const CURRENT_STATE = ["", "## Current State", "", "Everything is fine.", ""];

const GOOD_ENTRY = [
  "### 2026-01-02 — Something was done",
  "- Agent: supervisor",
  "- Changed: one file",
  "- Why: it needed doing",
  "- Validation: `node --test` -> 6 tests passed, 0 failed",
  "- Outcome: Accepted",
  "- Follow-up: none",
  ""
];

const LEDGER = (entries) => ["## Work Ledger", "", ...entries.flat()];

// Assembles a document from line arrays; `\n` endings unless crlf is asked for.
function doc(sections, { crlf = false } = {}) {
  const text = `${sections.flat().join("\n")}\n`;
  return crlf ? text.replaceAll("\n", "\r\n") : text;
}

const GOOD_DOC = doc([HEADER, CURRENT_STATE, LEDGER([GOOD_ENTRY])]);

const filler = (count, at = () => null, label = "Line") =>
  Array.from({ length: count }, (_, index) => at(index) ?? `${label} ${index + 1}.`);

// A temporary repository holding the given root-relative files, removed when
// the test finishes.
function makeRepo(t, files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "working-docs-audit-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text, "utf8");
  }
  return dir;
}

const audit = (dir, ...args) =>
  spawnSync(process.execPath, [TOOL, "--root", dir, ...args], { encoding: "utf8" });

const findings = (result) => (result.stdout.trim() === "" ? [] : result.stdout.trim().split("\n"));

// Most failure fixtures would also report a stale index, which says nothing
// about the check under test, so generate the index first and audit after.
function auditWithCurrentIndex(t, files) {
  const dir = makeRepo(t, files);
  const update = audit(dir, "--update");
  assert.equal(update.status, 0, update.stderr);
  return { dir, result: audit(dir) };
}

test("a conforming repository passes", (t) => {
  const { result } = auditWithCurrentIndex(t, { [DOC]: GOOD_DOC });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout.trim(), "working-docs: passed (1 documents)");
});

test("--update writes an index that then passes, listing the document", (t) => {
  const dir = makeRepo(t, { [DOC]: GOOD_DOC });
  const update = audit(dir, "--update");

  assert.equal(update.status, 0, update.stderr);
  assert.match(update.stdout, /wrote docs\/working\/README\.md \(1 documents\)/);

  const index = readFileSync(path.join(dir, "docs/working/README.md"), "utf8");
  assert.match(index, /^# Working Document Index$/m);
  assert.match(index, /^## Active$/m);
  assert.match(index, /\| Document \| Owner \| Lines \| Scope \| Paired \|/);
  assert.match(index, /\| \[example-plan\.md\]\(\.\/example-plan\.md\) \| supervisor \| \d+ \| the example \| none \|/);
  // No FluxIQ cross-repository sentence in the standalone index.
  assert.doesNotMatch(index, /FluxIQ/);

  assert.equal(audit(dir).status, 0);
});

test("a missing index fails", (t) => {
  const dir = makeRepo(t, { [DOC]: GOOD_DOC });
  const result = audit(dir);

  assert.equal(result.status, 1);
  assert.deepEqual(findings(result).length, 1);
  assert.match(result.stdout, /docs\/working\/README\.md is out of date with the documents' header blocks/);
});

test("an index that no longer matches the headers fails", (t) => {
  const dir = makeRepo(t, { [DOC]: GOOD_DOC });
  assert.equal(audit(dir, "--update").status, 0);
  writeFileSync(path.join(dir, DOC), GOOD_DOC.replace("Owner: supervisor", "Owner: someone else"), "utf8");

  const result = audit(dir);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /README\.md is out of date/);
});

test("a Status outside the vocabulary fails", (t) => {
  const text = GOOD_DOC.replace("Status: Active", "Status: Ongoing");
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /example-plan\.md:3: "Status:" must be one of Active, Paused, Blocked/);
});

test("a header missing a field fails at that line", (t) => {
  const text = doc([HEADER.filter((line) => !line.startsWith("Owner:")), CURRENT_STATE, LEDGER([GOOD_ENTRY])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /example-plan\.md:7: expected "Owner:" but found "Scope: the example"/);
});

test("an Active document with no Current State fails", (t) => {
  const text = doc([HEADER, ["", "## Notes", "", "No current state here.", ""], LEDGER([GOOD_ENTRY])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /Status is Active but there is no "## Current State" section/);
});

test("a Current State over the budget fails with its measured length", (t) => {
  const text = doc([HEADER, ["", "## Current State", "", ...filler(200), ""], LEDGER([GOOD_ENTRY])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  // Heading + blank + 200 body lines + trailing blank, up to `## Work Ledger`.
  assert.match(result.stdout, /"## Current State" is 203 lines, over the 150-line budget/);
});

test("a Current State under the budget passes, and an H3 does not end it", (t) => {
  const body = filler(140, (index) => (index === 100 ? "### A subheading" : null));
  const text = doc([HEADER, ["", "## Current State", "", ...body, ""], LEDGER([GOOD_ENTRY])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 0, result.stdout);
});

test("a ledger entry with no Validation bullet fails and is named", (t) => {
  const entry = GOOD_ENTRY.filter((line) => !line.startsWith("- Validation:"));
  const text = doc([HEADER, CURRENT_STATE, LEDGER([entry])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /1 Work Ledger entry does not record a validation result/);
  assert.match(result.stdout, /2026-01-02 — Something was done" \(no "- Validation:" bullet\)/);
});

test("a Validation bullet that repeats a report fails, including across a wrap", (t) => {
  const hearsay = [
    "### 2026-01-03 — Wrapped validation",
    "- Agent: supervisor",
    "- Validation: three workers were dispatched and each one of the three",
    "  workers said the suite passed, so it passed",
    "- Outcome: Accepted",
    ""
  ];
  const text = doc([HEADER, CURRENT_STATE, LEDGER([GOOD_ENTRY, hearsay])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /Wrapped validation" \(Validation repeats a report instead of a result\)/);
});

test("a document over the compaction threshold fails with its line count", (t) => {
  const text = doc([HEADER, CURRENT_STATE, ["## Body", "", ...filler(820), ""], LEDGER([GOOD_ENTRY])]);
  const { result } = auditWithCurrentIndex(t, { [DOC]: text });

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 1);
  assert.match(result.stdout, /\d+ lines exceeds the 800-line compaction threshold/);
  assert.match(result.stdout, /docs\/working\/example-plan\/archive\//);
});

test("several broken documents each report, one line per finding", (t) => {
  const noLedgerValidation = doc([HEADER, CURRENT_STATE, LEDGER([GOOD_ENTRY.filter((line) => !line.startsWith("- Validation:"))])]);
  const { result } = auditWithCurrentIndex(t, {
    [DOC]: noLedgerValidation,
    "docs/working/other-plan.md": GOOD_DOC.replace("Status: Active", "Status: Ongoing")
  });

  assert.equal(result.status, 1);
  const lines = findings(result);
  assert.equal(lines.length, 2);
  // Documents are audited in codepoint order.
  assert.match(lines[0], /example-plan\.md/);
  assert.match(lines[1], /other-plan\.md/);
});

test("CRLF documents are parsed the same as LF ones", (t) => {
  const clean = doc([HEADER, CURRENT_STATE, LEDGER([GOOD_ENTRY])], { crlf: true });
  assert.equal(auditWithCurrentIndex(t, { [DOC]: clean }).result.status, 0);

  const entry = GOOD_ENTRY.filter((line) => !line.startsWith("- Validation:"));
  const dirty = doc([HEADER, ["", "## Current State", "", ...filler(200), ""], LEDGER([entry])], { crlf: true });
  const result = auditWithCurrentIndex(t, { [DOC]: dirty }).result;

  assert.equal(result.status, 1);
  assert.equal(findings(result).length, 2);
});

test("the index, nested documents, and non-markdown files are not audited", (t) => {
  const { result } = auditWithCurrentIndex(t, {
    [DOC]: GOOD_DOC,
    "docs/working/example-plan/archive/old.md": "not a working document at all",
    "docs/working/notes.txt": "not markdown"
  });

  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout.trim(), "working-docs: passed (1 documents)");
});

test("a repository with no docs/working passes with no documents", (t) => {
  const dir = makeRepo(t, { "README.md": "# Nothing here\n" });
  const result = audit(dir);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "working-docs: passed (0 documents)");
});

test("in a git repository only tracked documents are audited", (t) => {
  const dir = makeRepo(t, {
    [DOC]: GOOD_DOC,
    // Untracked, and broken enough to report if it were ever read.
    "docs/working/scratch.md": "scratch notes with no header at all\n"
  });
  const git = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  git("init", "-q");
  git("add", DOC);

  assert.equal(audit(dir, "--update").status, 0);
  // The generated index must itself be tracked, or git's view of the directory
  // does not contain it and the audit reports it as missing.
  git("add", "docs/working/README.md");

  const result = audit(dir);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout.trim(), "working-docs: passed (1 documents)");
});

test("an unknown argument exits 2 with usage on stderr", (t) => {
  const dir = makeRepo(t, { [DOC]: GOOD_DOC });
  const result = audit(dir, "--fix");

  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument "--fix"/);
  assert.match(result.stderr, /Usage: node working-docs-audit\.mjs \[--root <repo>\] \[--update\]/);
});
