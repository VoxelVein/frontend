import { DISCLOSURE_TYPE_LABELS } from "@/lib/projects";
import type { ProjectDisclosure } from "@/lib/projects";

/**
 * The creator disclosures, shown on both project and server detail pages.
 *
 * A disclosure is not a warning: it is context the reader asked to see, so
 * each entry pairs its label with the sentence that explains it. The grid
 * stacks on narrow screens and reads in two columns from `sm` up.
 */
export const ProjectDisclosuresSection = ({
  disclosures,
}: {
  disclosures: readonly ProjectDisclosure[];
}) => (
  <section
    aria-labelledby="project-disclosures-heading"
    className="border-border bg-card rounded-xl border p-5 sm:p-6"
  >
    <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
      Transparency
    </p>
    <h2
      className="text-foreground mt-2 text-lg font-semibold"
      id="project-disclosures-heading"
    >
      Disclosures
    </h2>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {disclosures.map((disclosure) => (
        <li
          key={disclosure.type}
          className="border-border bg-background/60 rounded-lg border p-4"
        >
          <p className="text-foreground text-sm font-semibold">
            {DISCLOSURE_TYPE_LABELS[disclosure.type]}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            {disclosure.description}
          </p>
        </li>
      ))}
    </ul>
  </section>
);
