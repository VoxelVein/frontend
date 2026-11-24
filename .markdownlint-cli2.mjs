import { init } from "@github/markdownlint-github";
import markdownIt from "markdown-it";

// SAFETY: markdownlint parses this repository's own checked-in Markdown, not
// user-supplied content, so enabling raw HTML only lets it inspect HTML that
// the project already trusts.
const markdownItFactory = () =>
  // oxlint-disable-next-line sonarjs/disabled-auto-escaping -- Lints only checked-in docs, not untrusted user content.
  markdownIt({ html: true });

const options = {
  markdownItFactory,
  config: init({
    // MD041 (first-line-heading): files may intentionally begin with badges,
    // HTML, or images rather than a top-level heading.
    MD041: false,
    // MD024: Keep a Changelog repeats "Added"/"Changed"/"Fixed" under each
    // release heading, which is only a duplicate outside its own section.
    "no-duplicate-heading": { siblings_only: true },
  }),
  customRules: ["@github/markdownlint-github"],
  globs: ["**/*.md"],
  ignores: [
    ".opencode/**",
    // Agent-framework tooling (installed by the runtime, not project docs).
    ".agents/**",
    ".tmp/**",
    "node_modules/**",
    ".git/**",
    ".output/**",
    "dist/**",
  ],
  outputFormatters: [
    ["markdownlint-cli2-formatter-pretty", { appendLink: true }],
  ],
};

export default options;
