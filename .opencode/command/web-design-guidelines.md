---
description: Review UI code for Web Interface Guidelines compliance using the web-design-guidelines skill
tags: [ui, design, review, a11y, accessibility, design-system]
---

# Web Design Guidelines Command

Review UI code for compliance with the Web Interface Guidelines and the project's design system.

## Usage

```
/web-design-guidelines [files or directories to review]
```

If no files are specified, ask the user which files to review.

## Instructions

1. **Load the skill**, read `.opencode/skills/web-design-guidelines/SKILL.md` to get the full review rules and checklist.
2. **Fetch fresh guidelines**, retrieve the latest rules from Vercel Labs:
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
3. **Read the target files**, read the files the user wants reviewed (or ask which files).
4. **Apply the rules**, check the files against both the fetched guidelines and the project-specific rules from the skill.
5. **Output findings**, use the terse `file:line` format specified in the fetched guidelines.

## Review Checklist

Check in this order:

1. shadcn-only rule, native controls replaced with shadcn equivalents?
2. Semantic HTML and landmarks, one `<main>`, proper heading hierarchy?
3. Design tokens, OKLCH tokens only, no hardcoded colors?
4. Spacing and radius, Tailwind scale, consistent `rounded-*`?
5. States, hover, focus, loading, empty, error all handled?
6. Destructive actions, confirm dialogs, destructive variant only for danger?
7. Motion, under 400ms, transform/opacity only, reduced-motion respected?
8. Accessibility, keyboard nav, focus visibility, ARIA, contrast?
9. Responsive, mobile-first, 44px touch targets, breakpoint behavior?
10. Consistency, matches existing components, no parallel implementations?

## Notes

- Always fetch fresh guidelines before each review, the rules change over time
- Use the terse `file:line` output format for findings
- When a finding has a fix, suggest the exact shadcn component or token to use
- This command delegates to the `web-design-guidelines` skill for the full rule set
