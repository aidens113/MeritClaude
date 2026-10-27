// Audits docs/working/ the way FluxIQ Core's structure-audit `working-docs`
// rule does, but as one dependency-free file, for repositories that do not run
// the structure audit. For every `docs/working/*.md` except the index it
// checks:
//   * header block shape -- an H1, a blank line, then eight fields in a fixed
//     order, one per line, each with a value, and a `Status` drawn from the
//     status vocabulary;
//   * a `## Current State` section within 20 lines after the header while the
//     document's Status is Active;
//   * `## Current State` is at most 150 lines;
//   * every `## Work Ledger` entry carries a real `- Validation:` bullet that
//     names a result rather than repeating a report;
//   * the document is at most 800 lines;
//   * docs/working/README.md matches the index generated from the headers.
// Unlike the Core rule there is no ratchet and no baseline: every finding
// fails.
//
// Usage:  node <MeritClaude>/tools/working-docs-audit.mjs [--root <repo>] [--update]
//   (no flags)  prints one line per finding and exits 1 if there are any,
//               otherwise prints `working-docs: passed (<n> documents)` and
//               exits 0
//   --update    regenerates docs/working/README.md and exits 0
//   --root      the repository to audit; defaults to the current directory
//
// Ported from FluxIQ Core's structure-audit `working-docs` rule by way of the
// retired agent brain. The header block and section order it enforces are
// specified in templates/agent-working-doc-protocol.md, which /new-project
// copies into each repository's docs/working/.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const WORKING_DIR = "docs/working";
const INDEX_FILE = `${WORKING_DIR}/README.md`;

const FIELDS = ["Status", "Status detail", "Created", "Last updated", "Owner", "Scope", "Paired document", "Related"];
const STATUSES = ["Active", "Paused", "Blocked", "Complete", "Superseded", "Archived", "Unclassified"];
const GROUP_ORDER = ["Active", "Blocked", "Paused", "Complete", "Superseded", "Archived", "Unclassified"];

// H1 + blank line + the eight fields.
const HEADER_LINES = 2 + FIELDS.length;
// `## Current State` must appear within this many lines after the header.
const CURRENT_STATE_WINDOW = 20;
// The index reads header fields from this many lines after the H1, which
// tolerates a wrapped value that the header check reports separately.
const META_SCAN_LINES = 13;
// The compaction threshold for a whole document, and the budget for the one
// section every agent reads before every task.
const MAX_DOC_LINES = 800;
const MAX_CURRENT_STATE_LINES = 150;

// A `## Work Ledger` entry records what it ran on a bullet starting with this.
const VALIDATION_BULLET = "- Validation:";
// Phrases that mean an agent took a report at its word. The protocol requires
// the Validation bullet to name what a command actually printed, because a
// completion report is not by itself evidence that anything ran.
const HEARSAY = /reported success|workers? (reported|said|claimed)\b/i;

const FIELD_PATTERN = new RegExp(`^(${FIELDS.join("|")}): ?(.*)$`);
const KEY_PATTERN = /^[A-Z][A-Za-z ]*: /;

// Codepoint order, matching the Core rule's sort.
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Split on LF and drop a trailing CR so that CRLF documents parse the same as
// LF ones.
const splitLines = (text) => text.split("\n").map((line) => line.replace(/\r$/, ""));

// `## ` with the trailing space, so an H3 (`### `) is not read as a new section.
const isSection = (line) => line.startsWith("## ");

const basename = (file) => file.split("/").at(-1);

const read = (root, file) => readFileSync(path.join(root, file), "utf8");

// Lines the way the Core context counts them: a trailing newline adds none.
function lineCount(text) {
  if (text === "") return 0;
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

// --------------------------------------------------------------- discovery

// True only when root is the top level of a work tree, not merely somewhere
// inside one: a directory that happens to sit under an unrelated checkout (a
// home directory under version control, say) is not this repository, and
// asking git about it would report no files at all.
function isGitRepo(root) {
  try {
    const top = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
    });
    return path.relative(top.trim(), root) === "";
  } catch {
    return false;
  }
}

// Files under docs/working, as root-relative forward-slash paths. Git's view
// is preferred so that untracked scratch files are ignored the way the Core
// rule ignores them; a directory listing is the fallback for a checkout that
// is not a git repository.
function workingDirFiles(root) {
  if (isGitRepo(root)) {
    const out = execFileSync("git", ["-C", root, "ls-files", WORKING_DIR], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
    });
    return out.split("\n").map((line) => line.trim()).filter(Boolean)
      // A tracked file may have been deleted from the working tree; reading it
      // would throw, and it is no longer there to audit.
      .filter((file) => existsSync(path.join(root, file)));
  }
  const dir = path.join(root, WORKING_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${WORKING_DIR}/${entry.name}`);
}

// The documents themselves: top-level markdown only, the index excluded.
function workingDocs(files) {
  return files
    .filter((file) => file.startsWith(`${WORKING_DIR}/`)
      && file.endsWith(".md")
      && !file.slice(WORKING_DIR.length + 1).includes("/")
      && basename(file) !== "README.md")
    .sort(byName);
}

// ------------------------------------------------------------------ checks

function headerMeta(lines) {
  const meta = new Map();
  for (const line of lines.slice(1, 1 + META_SCAN_LINES)) {
    const match = FIELD_PATTERN.exec(line);
    if (match) meta.set(match[1], match[2].trim());
  }
  return meta;
}

function show(text) {
  if (text.trim() === "") return "a blank line";
  return `"${text.length > 60 ? `${text.slice(0, 60)}...` : text}"`;
}

function headerFinding(file, line, problem) {
  return `${file}:${line}: ${problem} The header block is eight fields in a fixed order (${FIELDS.join(", ")}), one per line, directly after the H1 and one blank line; see the protocol's Header block section.`;
}

// Returns the first deviation from the header shape, or null. One finding per
// document: the block is parsed positionally, so once a line is wrong every
// line after it is reported against the wrong field and the rest is noise.
function checkHeader(file, lines) {
  const at = (index) => lines[index] ?? "";
  if (!at(0).startsWith("# ")) {
    return headerFinding(file, 1, `expected an H1 title line ("# ...") but found ${show(at(0))}.`);
  }
  if (at(1).trim() !== "") {
    return headerFinding(file, 2, `expected a blank line after the H1 but found ${show(at(1))}.`);
  }
  for (const [index, field] of FIELDS.entries()) {
    const line = 3 + index;
    const text = at(line - 1);
    if (!text.startsWith(`${field}: `)) {
      const wrapped = !KEY_PATTERN.test(text) && text.trim() !== ""
        ? " This looks like the previous field's value wrapped onto a second line; a value must fit on one line."
        : "";
      return headerFinding(file, line, `expected "${field}:" but found ${show(text)}.${wrapped}`);
    }
    const value = text.slice(field.length + 2).trim();
    if (value === "") {
      return headerFinding(file, line, `"${field}:" has no value.`);
    }
    if (field === "Status" && !STATUSES.includes(value)) {
      return headerFinding(file, line, `"Status:" must be one of ${STATUSES.join(", ")} but found "${value}".`);
    }
  }
  return null;
}

// One `## <name>` section: its heading's 0-based index and the lines from that
// heading up to the next `## ` heading or the end of the document. Null when
// the document has no such section.
function section(lines, heading) {
  const start = lines.indexOf(heading);
  if (start === -1) return null;
  const offset = lines.slice(start + 1).findIndex(isSection);
  const end = offset === -1 ? lines.length : start + 1 + offset;
  return { start, lines: lines.slice(start, end) };
}

function checkCurrentState(file, lines, status) {
  if (status !== "Active") return null;
  const window = lines.slice(HEADER_LINES, HEADER_LINES + CURRENT_STATE_WINDOW);
  if (window.includes("## Current State")) return null;
  return `${file}: Status is Active but there is no "## Current State" section directly after the header.`;
}

// Current State is the one section every agent reads before every task, so its
// length is paid over and over.
function checkCurrentStateLength(file, lines) {
  const found = section(lines, "## Current State");
  if (!found) return null;
  const count = found.lines.length;
  if (count <= MAX_CURRENT_STATE_LINES) return null;
  return `${file}: "## Current State" is ${count} lines, over the ${MAX_CURRENT_STATE_LINES}-line budget. Every agent reads this section before every task, so keep only what the next one needs to act on and push the rest into the body or the archive.`;
}

// Splits a ledger section into its `### ` entries. Lines before the first
// entry (the heading itself, blank lines) belong to no entry and are dropped.
function ledgerEntries(sectionLines) {
  const entries = [];
  for (const line of sectionLines) {
    if (line.startsWith("### ")) entries.push({ title: line.slice(4).trim(), lines: [] });
    else entries.at(-1)?.lines.push(line);
  }
  return entries;
}

// The entry's Validation bullet joined with its wrapped continuation lines, so
// that a phrase split across a line break is still seen. A continuation is an
// indented non-blank line; the block ends at the next top-level bullet, a
// blank line, or the end of the entry. Null when the bullet is missing.
function validationText(entryLines) {
  const start = entryLines.findIndex((line) => line.startsWith(VALIDATION_BULLET));
  if (start === -1) return null;
  const block = [entryLines[start]];
  for (const line of entryLines.slice(start + 1)) {
    if (line.trim() === "" || !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  return block.join(" ");
}

// One finding per document rather than per entry, so that a document with a
// run of thin entries reports once and names every offender in that line.
function checkLedger(file, lines) {
  const ledger = section(lines, "## Work Ledger");
  if (!ledger) return null;

  const offenders = [];
  for (const entry of ledgerEntries(ledger.lines)) {
    const text = validationText(entry.lines);
    if (text === null) offenders.push(`"${entry.title}" (no "${VALIDATION_BULLET}" bullet)`);
    else if (HEARSAY.test(text)) offenders.push(`"${entry.title}" (Validation repeats a report instead of a result)`);
  }
  if (offenders.length === 0) return null;

  const subject = offenders.length === 1 ? "1 Work Ledger entry does" : `${offenders.length} Work Ledger entries do`;
  return `${file}: ${subject} not record a validation result: ${offenders.join("; ")}. Every entry needs a "${VALIDATION_BULLET}" bullet naming the exact command and what it actually printed; a worker's own report is not a validation result. If nothing ran, write "not validated" and say why.`;
}

function checkSize(file, text) {
  const lines = lineCount(text);
  if (lines <= MAX_DOC_LINES) return null;
  const slug = basename(file).replace(/\.md$/, "");
  return `${file}: ${lines} lines exceeds the ${MAX_DOC_LINES}-line compaction threshold. Compact it the next time work touches it: fold settled outcomes into Current State and move superseded detail to ${WORKING_DIR}/${slug}/archive/.`;
}

// Every finding for one document, in a fixed order: header first, because a
// broken header is usually the cause of what follows.
function checkDocument(file, text) {
  const lines = splitLines(text);
  return [
    checkHeader(file, lines),
    checkCurrentState(file, lines, headerMeta(lines).get("Status")),
    checkCurrentStateLength(file, lines),
    checkLedger(file, lines),
    checkSize(file, text)
  ].filter((finding) => finding !== null);
}

// ------------------------------------------------------------------- index

// One row's worth of index data, derived only from the header block.
function indexEntry(root, file) {
  const text = read(root, file);
  const meta = headerMeta(splitLines(text));
  const status = meta.get("Status") ?? "Unclassified";
  const rawPaired = (meta.get("Paired document") ?? "none").replace(/^`+/, "").replace(/`+$/, "");
  return {
    name: basename(file),
    status: GROUP_ORDER.includes(status) ? status : "Unclassified",
    owner: meta.get("Owner") ?? "unassigned",
    lines: lineCount(text),
    scope: (meta.get("Scope") ?? "").replaceAll("|", "\\|"),
    paired: rawPaired === "none" ? "none" : rawPaired.replaceAll("\\", "/").split("/").at(-1)
  };
}

function generateIndex(root, docs) {
  const entries = docs.map((file) => indexEntry(root, file));

  const out = [
    "# Working Document Index", "",
    "Every working document in this repository is listed here, grouped by the",
    "`Status` field of its header block. This index is derived from those headers",
    "and regenerated when a document is created, retired, or re-statused; edit the",
    "document's header, not this table. Read it first, pick the relevant document,",
    "then read that document's `Current State` section before anything else.", "",
    "Format, status vocabulary, ledger rules, worker briefs, and cross-repository",
    "pairing are defined in",
    "[Agent Working Document Protocol](./agent-working-doc-protocol.md).", ""
  ];

  for (const status of GROUP_ORDER) {
    const group = entries.filter((entry) => entry.status === status);
    if (group.length === 0) continue;
    out.push(`## ${status}`, "");
    if (status === "Superseded") {
      out.push("These no longer own current status; each names its successor in `Status",
        "detail`. Retained for evidence. Do not plan current work from them.", "");
    }
    out.push("| Document | Owner | Lines | Scope | Paired |", "| --- | --- | --- | --- | --- |");
    for (const entry of group) {
      const flag = entry.lines > MAX_DOC_LINES ? " \u26a0" : "";
      const paired = entry.paired === "none" ? "none" : `\`${entry.paired}\``;
      out.push(`| [${entry.name}](./${entry.name}) | ${entry.owner} | ${entry.lines}${flag} | ${entry.scope} | ${paired} |`);
    }
    out.push("");
  }

  const oversized = entries.filter((entry) => entry.lines > MAX_DOC_LINES).length;
  out.push(`\u26a0 marks documents over the ${MAX_DOC_LINES}-line compaction threshold (${oversized} of ${entries.length} here).`,
    "Compact them the next time work touches them; do not schedule a bulk rewrite.", "");
  return out.join("\n");
}

// The checked-in index must still match what the headers generate, so that a
// re-statused or renamed document cannot silently drift out of the table.
function checkIndex(root, files, docs) {
  const current = files.includes(INDEX_FILE) ? read(root, INDEX_FILE) : null;
  if (current === generateIndex(root, docs)) return null;
  return `${INDEX_FILE} is out of date with the documents' header blocks. Run "node working-docs-audit.mjs --update" to regenerate it.`;
}

// -------------------------------------------------------------------- main

function parseArgs(argv) {
  const options = { root: process.cwd(), update: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--update") {
      options.update = true;
    } else if (arg === "--root") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error("--root needs a path");
      options.root = value;
      index += 1;
    } else if (arg.startsWith("--root=")) {
      options.root = arg.slice("--root=".length);
    } else {
      throw new Error(`unknown argument "${arg}"`);
    }
  }
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`working-docs: ${error.message}\nUsage: node working-docs-audit.mjs [--root <repo>] [--update]\n`);
    return 2;
  }

  const root = path.resolve(options.root);
  const files = workingDirFiles(root);
  const docs = workingDocs(files);

  if (options.update) {
    if (!existsSync(path.join(root, WORKING_DIR))) {
      process.stderr.write(`working-docs: no ${WORKING_DIR} directory under ${root}; nothing to write\n`);
      return 0;
    }
    writeFileSync(path.join(root, INDEX_FILE), generateIndex(root, docs), "utf8");
    process.stdout.write(`working-docs: wrote ${INDEX_FILE} (${docs.length} documents)\n`);
    return 0;
  }

  // A repository with no working documents has nothing to index either, so it
  // passes rather than being told its absent index is out of date.
  if (docs.length === 0) {
    process.stdout.write("working-docs: passed (0 documents)\n");
    return 0;
  }

  const findings = docs.flatMap((file) => checkDocument(file, read(root, file)));
  const index = checkIndex(root, files, docs);
  if (index) findings.push(index);

  if (findings.length === 0) {
    process.stdout.write(`working-docs: passed (${docs.length} documents)\n`);
    return 0;
  }
  process.stdout.write(`${findings.join("\n")}\n`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
