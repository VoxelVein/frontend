import { IconMailExclamation } from "@tabler/icons-react";

/** Shown to signed-in users who may not publish content yet. */
export const VerificationNotice = () => (
  <section
    aria-labelledby="verification-heading"
    className="border-border bg-muted/50 mt-8 flex gap-4 rounded-xl border p-6"
  >
    <IconMailExclamation
      size={24}
      aria-hidden="true"
      className="text-primary shrink-0"
    />
    <div>
      <h2
        id="verification-heading"
        className="text-foreground text-lg font-semibold"
      >
        Verify your email to publish
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Only accounts with a verified email address can upload mods and plugins.
        Accounts created with Google or GitHub are verified automatically.
      </p>
    </div>
  </section>
);
