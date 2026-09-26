import { Checkbox } from "@/components/ui/checkbox";

interface CheckboxGroupProps {
  error?: string;
  formatLabel?: (value: string) => string;
  id: string;
  legend: string;
  onChange: (values: string[]) => void;
  options: readonly string[];
  values: readonly string[];
}

const asIs = (value: string) => value;

/** Multi-select as a fieldset of checkboxes, with an inline error. */
export const CheckboxGroup = ({
  error,
  formatLabel = asIs,
  id,
  legend,
  onChange,
  options,
  values,
}: CheckboxGroupProps) => {
  const errorId = `${id}-error`;
  const selected = new Set(values);
  const toggle = (option: string, checked: boolean) =>
    onChange(
      checked ? [...values, option] : values.filter((value) => value !== option)
    );

  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="grid gap-2"
    >
      <legend className="text-foreground mb-2 text-sm font-medium">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-x-4">
        {options.map((option) => {
          const optionId = `${id}-${option}`;
          return (
            <div key={option} className="flex min-h-11 items-center gap-2">
              <Checkbox
                id={optionId}
                checked={selected.has(option)}
                onCheckedChange={(checked) => toggle(option, checked)}
              />
              <label htmlFor={optionId} className="text-foreground text-sm">
                {formatLabel(option)}
              </label>
            </div>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};
