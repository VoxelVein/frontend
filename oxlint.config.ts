import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import vitest from "ultracite/oxlint/vitest";

const jsPlugins = selectJsPlugins(["react-doctor", "sonarjs"]);

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    vitest,
    tanstackJsPlugins,
    antiSlop,
    jsPlugins,
  ],
  ignorePatterns: ["**/.opencode/**", ...(core.ignorePatterns ?? [])],
  jsPlugins: jsPlugins.jsPlugins,
  settings: jsPluginSettings,
  rules: {
    /**
     * Warn, don't block.
     *
     * The rule fires on "a repeated class followed by a required character or
     * an end anchor". That shape is everywhere, and most instances of it are
     * linear. Probed against this repo at the version that promoted it: a
     * negated class plus an end anchor fires, while a bare star does not, so
     * the trigger is the trailing anchor rather than the repetition.
     *
     * Twelve existing patterns tripped it, all with bounded inputs — post
     * bodies and usernames are length-capped, the doc-link checker only ever
     * reads this repository, and the storage URL is one env var. Rewriting
     * them to satisfy the rule meant either changing what a valid address is
     * or moving work out of regex entirely, which costs more than it buys.
     *
     * The one pattern that genuinely was super-linear — the sign-in address
     * check, quadratic on a long string with no `@` and no length cap on the
     * input — is bounded to the RFC 5321 limits instead. So the real exposure
     * is closed, and this stays a warning that surfaces the shape in new code
     * without failing the build over patterns that cannot misbehave.
     */
    "sonarjs/super-linear-regex": "warn",
  },
});
