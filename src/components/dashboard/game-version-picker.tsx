import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  filterGameVersions,
  LINE_PREFIX,
  newestFirst,
} from "@/lib/game-version-search";
import {
  getMinecraftVersion,
  getReleasesInLine,
  isSnapshotVersion,
} from "@/lib/minecraft-versions";

const describeVersion = (id: string): string | null => {
  if (isSnapshotVersion(id)) {
    return "Snapshot";
  }
  return getMinecraftVersion(id)?.update || null;
};

interface GameVersionPickerProps {
  error?: string;
  id: string;
  label?: string;
  onChange: (values: string[]) => void;
  values: readonly string[];
}

/**
 * Searchable multi-select for Minecraft versions. Hundreds of versions exist,
 * so users type to find them instead of scanning a grid of checkboxes.
 */
export const GameVersionPicker = ({
  error,
  id,
  label = "Game versions",
  onChange,
  values,
}: GameVersionPickerProps) => {
  const [query, setQuery] = useState("");
  const [includeSnapshots, setIncludeSnapshots] = useState(() =>
    values.some(isSnapshotVersion)
  );
  const snapshotToggleId = useId();
  const inputId = `${id}-input`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const options = filterGameVersions(query, includeSnapshots);

  const handleChange = (next: string[]) => {
    // A line option expands into every release of that line.
    const expanded = next.flatMap((value) =>
      value.startsWith(LINE_PREFIX)
        ? getReleasesInLine(value.slice(LINE_PREFIX.length))
        : [value]
    );
    const addedLine = next.some((value) => value.startsWith(LINE_PREFIX));
    if (addedLine) {
      setQuery("");
    }
    onChange(newestFirst(expanded));
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="text-foreground text-sm font-medium"
        >
          {label}
        </label>
        <div className="flex items-center gap-1">
          <label
            htmlFor={snapshotToggleId}
            className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm"
          >
            <Checkbox
              id={snapshotToggleId}
              checked={includeSnapshots}
              onCheckedChange={(checked) => setIncludeSnapshots(checked)}
            />
            Show snapshots
          </label>
          {values.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          ) : null}
        </div>
      </div>

      <Combobox
        multiple
        items={options}
        filteredItems={options}
        value={[...values]}
        onValueChange={handleChange}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={(value: string) =>
          value.startsWith(LINE_PREFIX)
            ? `All ${value.slice(LINE_PREFIX.length)}.x releases`
            : value
        }
      >
        <ComboboxChips>
          {values.map((value) => (
            <ComboboxChip key={value} removeLabel={`Remove ${value}`}>
              {value}
            </ComboboxChip>
          ))}
          <ComboboxInput
            id={inputId}
            placeholder={
              values.length > 0 ? "Add more…" : "Type a version, like 1.20"
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          />
        </ComboboxChips>

        <ComboboxContent>
          <ComboboxEmpty>No matching versions.</ComboboxEmpty>
          <ComboboxList>
            {(value: string) => {
              if (value.startsWith(LINE_PREFIX)) {
                const line = value.slice(LINE_PREFIX.length);
                return (
                  <ComboboxItem
                    key={value}
                    value={value}
                    className="font-medium"
                  >
                    Add all {line}.x releases
                    <span className="text-muted-foreground text-xs font-normal">
                      ({getReleasesInLine(line).length})
                    </span>
                  </ComboboxItem>
                );
              }
              const detail = describeVersion(value);
              return (
                <ComboboxItem key={value} value={value}>
                  {value}
                  {detail ? (
                    <span className="text-muted-foreground text-xs">
                      {detail}
                    </span>
                  ) : null}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <p id={helpId} className="text-muted-foreground text-sm">
        {values.length === 0
          ? "Search to find a version. Enter a line like 1.20 to add every release in it."
          : `${values.length} selected. Search to add more.`}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
};
