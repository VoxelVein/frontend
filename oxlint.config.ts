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
  overrides: [
    {
      files: ["src/components/ui/**"],
      rules: {
        // Generated shadcn components use named function declarations and
        // export small style helpers alongside components by design.
        "eslint/func-style": "off",
        "eslint/no-use-before-define": "off",
        "import/consistent-type-specifier-style": "off",
        "jsx-a11y/prefer-tag-over-role": "off",
        "react-doctor/only-export-components": "off",
        "sonarjs/function-name": "off",
        "sonarjs/shorthand-property-grouping": "off",

        // These rules demand boundary parsing and strict typing of values that
        // are handed to the components already typed by recharts / base-ui.
        // Adding parsers inside vendored shadcn code would change its runtime
        // behaviour and be overwritten on the next regeneration.
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",

        // react/todo reports React Compiler HIR limitations (JSX elements that
        // cannot be safely reordered) in generated toast defaults, not a bug
        // that can be fixed without rewriting the generated component.
        "react/todo": "off",

        // shadcn's provider primitives deliberately expose their API to the
        // parent from an effect, build inline context values, and define the
        // day-picker render props inline. These are their public contracts.
        "react/set-state-in-effect": "off",
        "react-doctor/no-pass-live-state-to-parent": "off",
        "react-doctor/no-prop-callback-in-effect": "off",
        "react-doctor/no-pass-data-to-parent": "off",
        "react-doctor/effect-needs-cleanup": "off",
        "react/jsx-no-constructed-context-values": "off",
        "react/no-unstable-nested-components": "off",
        "react-doctor/no-locale-format-in-render": "off",
        "react-doctor/rerender-memo-before-early-return": "off",
        "react-doctor/prefer-dynamic-import": "off",

        // State naming, JSX default props, and the generated <style> injection
        // are copied verbatim from shadcn; the sidebar and chart rely on them.
        "react/hook-use-state": "off",
        "react/no-object-type-as-default-prop": "off",
        "react/no-danger": "off",

        // The remaining rules are style/correctness heuristics that fire on
        // the generated shapes: code lines and chart entries have no stable
        // domain ids, render-prop parameters intentionally shadow outer names,
        // and the complexity/union metrics describe fixed shadcn unions.
        "react-doctor/no-array-index-as-key": "off",
        "react-doctor/js-combine-iterations": "off",
        "eslint/no-shadow": "off",
        "eslint/complexity": "off",
        "eslint/no-nested-ternary": "off",
        "eslint/no-param-reassign": "off",
        "eslint/no-empty-function": "off",
        "sonarjs/no-inconsistent-returns": "off",
        "sonarjs/expression-complexity": "off",
        "sonarjs/max-union-size": "off",
        "sonarjs/pseudo-random": "off",
        "jsx-a11y/label-has-associated-control": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "unicorn/prefer-export-from": "off",
        "unicorn/no-document-cookie": "off",
      },
    },
  ],
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
     * Twelve existing patterns tripped it, all with bounded inputs  -  post
     * bodies and usernames are length-capped, the doc-link checker only ever
     * reads this repository, and the storage URL is one env var. Rewriting
     * them to satisfy the rule meant either changing what a valid address is
     * or moving work out of regex entirely, which costs more than it buys.
     *
     * The one pattern that genuinely was super-linear  -  the sign-in address
     * check, quadratic on a long string with no `@` and no length cap on the
     * input  -  is bounded to the RFC 5321 limits instead. So the real exposure
     * is closed, and this stays a warning that surfaces the shape in new code
     * without failing the build over patterns that cannot misbehave.
     */
    "sonarjs/super-linear-regex": "warn",
  },
});
