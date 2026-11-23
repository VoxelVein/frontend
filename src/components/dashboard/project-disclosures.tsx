import { FormTextarea } from "@/components/form-textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DISCLOSURE_DESCRIPTION_MAX_LENGTH,
  DISCLOSURE_TYPES,
  DISCLOSURE_TYPE_HINTS,
  DISCLOSURE_TYPE_LABELS,
} from "@/lib/projects";
import type { DisclosureType, ProjectDisclosure } from "@/lib/projects";

interface ProjectDisclosuresProps {
  disclosures: readonly ProjectDisclosure[];
  /** First validation message for the disclosures field. */
  error?: string;
  onChange: (disclosures: ProjectDisclosure[]) => void;
}

const HELP_ID = "project-disclosures-help";
const ERROR_ID = "project-disclosures-error";

/**
 * Optional project disclosures, each ticked type expanding into the sentence
 * a reader needs beside it.
 *
 * The description is required for every ticked type: "Statistics" on its own
 * does not say which data was used, and the disclosure exists to answer that.
 */
export const ProjectDisclosures = ({
  disclosures,
  error,
  onChange,
}: ProjectDisclosuresProps) => {
  const selected = new Map(
    disclosures.map((disclosure) => [disclosure.type, disclosure])
  );

  const toggle = (type: DisclosureType, checked: boolean) =>
    onChange(
      checked
        ? [...disclosures, { description: "", type }]
        : disclosures.filter((disclosure) => disclosure.type !== type)
    );

  const changeDescription = (type: DisclosureType, description: string) =>
    onChange(
      disclosures.map((disclosure) =>
        disclosure.type === type ? { ...disclosure, description } : disclosure
      )
    );

  return (
    <fieldset
      aria-describedby={error ? `${HELP_ID} ${ERROR_ID}` : HELP_ID}
      aria-invalid={error ? true : undefined}
      className="grid max-w-2xl gap-4"
    >
      <legend className="text-foreground text-sm font-medium">
        Which disclosures apply?
      </legend>
      <p id={HELP_ID} className="text-muted-foreground -mt-2 text-sm">
        Tick everything readers should know before they download. Each one needs
        a short explanation.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {DISCLOSURE_TYPES.map((type) => {
          const checkboxId = `project-disclosure-${type}`;

          return (
            <div
              key={type}
              className="border-border bg-background/50 flex min-h-11 items-center gap-2 rounded-lg border px-3"
            >
              <Checkbox
                id={checkboxId}
                checked={selected.has(type)}
                onCheckedChange={(checked) => toggle(type, checked)}
              />
              <label htmlFor={checkboxId} className="text-foreground text-sm">
                {DISCLOSURE_TYPE_LABELS[type]}
              </label>
            </div>
          );
        })}
      </div>

      {selected.size > 0 ? (
        <div className="grid gap-4">
          {Array.from(selected.values(), (disclosure) => (
            <FormTextarea
              key={disclosure.type}
              id={`project-disclosure-${disclosure.type}-description`}
              label={`Describe ${DISCLOSURE_TYPE_LABELS[disclosure.type].toLowerCase()}`}
              value={disclosure.description}
              onChange={(event) =>
                changeDescription(disclosure.type, event.target.value)
              }
              helperText={DISCLOSURE_TYPE_HINTS[disclosure.type]}
              maxLength={DISCLOSURE_DESCRIPTION_MAX_LENGTH}
              rows={3}
              required
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p id={ERROR_ID} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};
