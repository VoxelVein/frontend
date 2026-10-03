import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Fails when a relative Markdown link points at a file or heading anchor that
 * does not exist.
 *
 * These break silently. markdownlint has no rule for link targets, so renaming
 * a section leaves every link to its anchor quietly pointing at nothing, and
 * nothing else in the pipeline notices.
 */

const ROOTS = ["docs"];
const ROOT_FILES = [
  "README.md",
  "ROADMAP.md",
  "TODO.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
];

const exists = (file: string): boolean => {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
};

const markdownFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return markdownFiles(full);
    }
    return full.endsWith(".md") ? [full] : [];
  });

/** GitHub-style anchors: lowercase, spaces to hyphens, punctuation dropped. */
const anchorFor = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9 -]/gu, "")
    .replaceAll(" ", "-");

const anchorsIn = (file: string): Set<string> => {
  const anchors = new Set<string>();
  const text = readFileSync(file, "utf-8");
  for (const match of text.matchAll(/^#{1,6}\s+(?<heading>.*)$/gmu)) {
    anchors.add(anchorFor(match.groups?.heading ?? ""));
  }
  return anchors;
};

const files = [
  ...ROOTS.flatMap(markdownFiles),
  ...ROOT_FILES.filter((file) => exists(file)),
];

/**
 * Blanks out inline code spans, keeping their length so offsets still line up.
 *
 * A document that explains Markdown has to write things like `[a](b)`. Without
 * this, the link pattern matches that example and reports it as a broken link to
 * a file called `b` — a false positive that would otherwise force such
 * documentation to be written less precisely.
 *
 * Fenced blocks are handled by the same substitution, since a fence is just a
 * run of backticks longer than the span markers around it.
 */
const withoutCode = (text: string): string =>
  text.replaceAll(/(?<fence>`+)(?:[^`]|(?!\k<fence>)`)*\k<fence>/gu, (span) =>
    " ".repeat(span.length)
  );

const broken: string[] = [];

for (const file of files) {
  const text = readFileSync(file, "utf-8");
  const dir = path.dirname(file);

  for (const match of withoutCode(text).matchAll(
    /\[[^\]]*\]\(\s*(?<target>[^)\s]+)\s*\)/gu
  )) {
    const link = match.groups?.target?.trim() ?? "";

    // External, mailto, and bare anchors within the same file are skipped
    // rather than `continue`d, to keep this loop to a single exit.
    if (/^(?:https?:|mailto:|#)/u.test(link)) {
      continue;
    }

    const [target, anchor] = link.split("#");
    const resolved = path.join(dir, target);
    const missingFile = !exists(resolved);
    // A renamed heading leaves the anchor pointing at nothing, and
    // markdownlint has no rule for it.
    const missingAnchor =
      !missingFile &&
      Boolean(anchor) &&
      resolved.endsWith(".md") &&
      !anchorsIn(resolved).has((anchor ?? "").toLowerCase());

    if (missingFile) {
      broken.push(`${file}: ${link} (no such file)`);
    } else if (missingAnchor) {
      broken.push(`${file}: ${link} (no such heading)`);
    }
  }
}

if (broken.length > 0) {
  process.stderr.write(
    `Broken internal documentation links (${broken.length}):\n${broken
      .map((line) => `  ${line}`)
      .join("\n")}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `Checked ${files.length} Markdown files, all internal links resolve.\n`
);
