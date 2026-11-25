import { IconFilterOff, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxField,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCategory } from "@/lib/format";
import { filterGameVersions } from "@/lib/game-version-search";
import { searchHintFor, sortOptionsFor } from "@/lib/project-browser";
import {
  CLIENT_REQUIREMENT_LABELS,
  CLIENT_REQUIREMENTS,
  hasLoaders,
  LOADER_LABELS,
  LOADERS_BY_TYPE,
  PROJECT_TYPE_LABELS,
} from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";
import { cn } from "@/lib/utils";

/**
 * The browse filter panel.
 *
 * Labels are visible rather than screen-reader-only: a stack of selects whose
 * only explanation is the selected value asks the reader to open each one to
 * find out what it filters. The panel header also states what a type can be
 * filtered by, so a type without loaders does not imply a missing field.
 */

interface SearchBarProps {
  onQueryChange: (value: string) => void;
  query: string;
  type: ProjectType;
}

const SearchBar = ({ onQueryChange, query, type }: SearchBarProps) => (
  <div>
    <Label className="sr-only" htmlFor={`${type}-search`}>
      Search {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}
    </Label>
    <InputGroup className="bg-background h-12 rounded-xl shadow-xs">
      <InputGroupAddon>
        <IconSearch size={18} stroke={1.8} aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        id={`${type}-search`}
        name="query"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={`Search ${PROJECT_TYPE_LABELS[type].plural.toLowerCase()}…`}
        autoComplete="off"
        className="h-full pr-2 text-base"
      />
      {query ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
            size="icon-sm"
          >
            <IconX size={16} aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  </div>
);

interface FilterFieldProps {
  children: ReactNode;
  htmlFor: string;
  label: string;
}

const FilterField = ({ children, htmlFor, label }: FilterFieldProps) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <Label
      className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
      htmlFor={htmlFor}
    >
      {label}
    </Label>
    {children}
  </div>
);

const CLIENT_REQUIREMENT_OPTIONS = [
  { label: "Any client", value: "" },
  ...CLIENT_REQUIREMENTS.map((value) => ({
    label: CLIENT_REQUIREMENT_LABELS[value],
    value,
  })),
];

const ClientRequirementFilter = ({
  onChange,
  value,
}: {
  onChange: (value: string | null) => void;
  value: string;
}) => (
  <FilterField htmlFor="server-client-requirement" label="Client requirement">
    <Select
      items={CLIENT_REQUIREMENT_OPTIONS}
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger
        id="server-client-requirement"
        className="bg-background min-h-10 w-full"
      >
        <SelectValue placeholder="Any client" />
      </SelectTrigger>
      <SelectContent>
        {CLIENT_REQUIREMENT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </FilterField>
);

const GameVersionFilter = ({
  onChange,
  type,
  value,
}: {
  onChange: (value: string | null) => void;
  type: ProjectType;
  value: string;
}) => {
  const [query, setQuery] = useState("");
  const options = filterGameVersions(query, true, false);

  return (
    <Combobox
      items={options}
      filteredItems={options}
      value={value || null}
      onValueChange={(next: string | null) => {
        setQuery("");
        onChange(next);
      }}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxField
        id={`${type}-game-version`}
        placeholder={value ? `Minecraft ${value}` : "All versions"}
        className={cn(
          "bg-background min-h-10 w-full [&>input]:h-full",
          value && "placeholder:text-foreground"
        )}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching versions.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              Minecraft {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};

const GameVersionField = ({
  onChange,
  type,
  value,
}: {
  onChange: (value: string | null) => void;
  type: ProjectType;
  value: string;
}) => (
  <FilterField htmlFor={`${type}-game-version`} label="Game version">
    <div className="flex gap-1">
      <div className="min-w-0 flex-1">
        <GameVersionFilter type={type} value={value} onChange={onChange} />
      </div>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-10 shrink-0"
          aria-label="Show all versions"
          onClick={() => onChange(null)}
        >
          <IconX size={16} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  </FilterField>
);

interface FiltersProps {
  category: string;
  categories: readonly string[];
  clientRequirement: string;
  gameVersion: string;
  loader: string;
  onCategoryChange: (value: string | null) => void;
  onClientRequirementChange: (value: string | null) => void;
  onGameVersionChange: (value: string | null) => void;
  onLoaderChange: (value: string | null) => void;
  onSortChange: (value: string | null) => void;
  sort: string;
  type: ProjectType;
}

const Filters = ({
  category,
  categories,
  clientRequirement,
  gameVersion,
  loader,
  onCategoryChange,
  onClientRequirementChange,
  onGameVersionChange,
  onLoaderChange,
  onSortChange,
  sort,
  type,
}: FiltersProps) => (
  <div
    className={cn(
      "grid gap-4 sm:grid-cols-2",
      hasLoaders(type) || type === "server"
        ? "lg:grid-cols-4"
        : "lg:grid-cols-3"
    )}
  >
    <FilterField htmlFor={`${type}-category`} label="Category">
      <Select
        items={[
          { label: "All categories", value: "" },
          ...categories.map((value) => ({
            label: formatCategory(value),
            value,
          })),
        ]}
        value={category}
        onValueChange={onCategoryChange}
      >
        <SelectTrigger
          id={`${type}-category`}
          className="bg-background min-h-10 w-full"
        >
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
          {categories.map((value) => (
            <SelectItem key={value} value={value}>
              {formatCategory(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>

    <GameVersionField
      type={type}
      value={gameVersion}
      onChange={onGameVersionChange}
    />

    {type === "server" ? (
      <ClientRequirementFilter
        value={clientRequirement}
        onChange={onClientRequirementChange}
      />
    ) : null}

    {hasLoaders(type) ? (
      <FilterField
        htmlFor={`${type}-loader`}
        label={LOADER_LABELS[type].singular}
      >
        <Select
          items={[
            {
              label: `All ${LOADER_LABELS[type].plural.toLowerCase()}`,
              value: "",
            },
            ...LOADERS_BY_TYPE[type].map((value) => ({
              label: formatCategory(value),
              value,
            })),
          ]}
          value={loader}
          onValueChange={onLoaderChange}
        >
          <SelectTrigger
            id={`${type}-loader`}
            className="bg-background min-h-10 w-full"
          >
            <SelectValue
              placeholder={`All ${LOADER_LABELS[type].plural.toLowerCase()}`}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">
              All {LOADER_LABELS[type].plural.toLowerCase()}
            </SelectItem>
            {LOADERS_BY_TYPE[type].map((value) => (
              <SelectItem key={value} value={value}>
                {formatCategory(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    ) : null}

    <FilterField htmlFor={`${type}-sort`} label="Sort by">
      <Select
        items={sortOptionsFor(type)}
        value={sort}
        onValueChange={onSortChange}
      >
        <SelectTrigger
          id={`${type}-sort`}
          className="bg-background min-h-10 w-full"
        >
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptionsFor(type).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  </div>
);

export interface ProjectBrowserFiltersProps extends FiltersProps {
  filterCount: number;
  hasFilters: boolean;
  onClearFilters: () => void;
  onQueryChange: (value: string) => void;
  query: string;
}

export const ProjectBrowserFilters = ({
  category,
  categories,
  clientRequirement,
  filterCount,
  gameVersion,
  hasFilters,
  loader,
  onCategoryChange,
  onClearFilters,
  onClientRequirementChange,
  onGameVersionChange,
  onLoaderChange,
  onQueryChange,
  onSortChange,
  query,
  sort,
  type,
}: ProjectBrowserFiltersProps) => (
  <section
    aria-label="Search and filters"
    className="border-border bg-card mt-8 overflow-hidden rounded-xl border shadow-xs"
  >
    <div className="border-border/70 bg-muted/20 border-b px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="border-primary/20 bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg border">
            <IconSearch size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Find a project
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {searchHintFor(type)}
            </p>
          </div>
        </div>
        {hasFilters ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <span className="tabular-nums">{filterCount}</span> active
            </Badge>
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <IconFilterOff size={16} aria-hidden="true" />
              Reset filters
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <SearchBar query={query} onQueryChange={onQueryChange} type={type} />
      </div>
    </div>

    <div className="px-4 py-4 sm:px-6">
      <Filters
        category={category}
        categories={categories}
        clientRequirement={clientRequirement}
        onClientRequirementChange={onClientRequirementChange}
        gameVersion={gameVersion}
        loader={loader}
        onCategoryChange={onCategoryChange}
        onGameVersionChange={onGameVersionChange}
        onLoaderChange={onLoaderChange}
        onSortChange={onSortChange}
        sort={sort}
        type={type}
      />
    </div>
  </section>
);
