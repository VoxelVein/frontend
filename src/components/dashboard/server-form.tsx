import { IconX } from "@tabler/icons-react";
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { safeParse } from "valibot";

import { GameVersionPicker } from "@/components/dashboard/game-version-picker";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxField,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  errorMessage,
  NO_FIELD_ERRORS,
  toFieldErrors,
} from "@/lib/form-errors";
import type { FieldErrors } from "@/lib/form-errors";
import { searchProjects } from "@/lib/project-search.functions";
import {
  DEFAULT_SERVER_PORT,
  MAX_SERVER_LINKS,
  PROJECT_TYPE_LABELS,
  SERVER_LINK_TYPES,
  serverInputSchema,
} from "@/lib/projects";
import type {
  ProjectServerView,
  ServerLinkType,
  ServerLinkView,
} from "@/lib/projects";
import { saveServerDetails } from "@/lib/projects.functions";

interface LinkOption {
  id: string;
  name: string;
  slug: string;
}

interface ServerFormProps {
  onSaved: () => Promise<void> | void;
  projectId: string;
  server: ProjectServerView | null;
}

const PORT_PATTERN = /^\d+$/u;

/** Finds published projects of one type by name while the user types. */
const useProjectSearch = (
  type: ServerLinkType,
  query: string
): LinkOption[] => {
  const [debounced] = useDebouncedValue(query, { wait: 250 });
  const [options, setOptions] = useState<LinkOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let next: LinkOption[] = [];
      try {
        const result = await searchProjects({
          data: { query: debounced, sort: "downloads:desc", type },
        });
        next = result.hits.map(({ id, name, slug }) => ({ id, name, slug }));
      } catch {
        // Search is down: offer nothing rather than a stale list.
      }
      if (!cancelled) {
        setOptions(next);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [debounced, type]);

  return options;
};

const isServerLinkTypeValue = (value: unknown): value is ServerLinkType =>
  SERVER_LINK_TYPES.some((type) => type === value);

interface LinkedContentProps {
  error?: string;
  links: ServerLinkView[];
  onChange: (links: ServerLinkView[]) => void;
}

/** Picks mods, modpacks, shaders, and resource packs to link, of any mix. */
const LinkedContent = ({ error, links, onChange }: LinkedContentProps) => {
  const [type, setType] = useState<ServerLinkType>("modpack");
  const [query, setQuery] = useState("");
  const linkedIds = new Set(links.map((link) => link.id));
  const options = useProjectSearch(type, query).filter(
    (option) => !linkedIds.has(option.id)
  );
  const full = links.length >= MAX_SERVER_LINKS;

  const add = (option: LinkOption | null) => {
    setQuery("");
    if (!option || linkedIds.has(option.id) || full) {
      return;
    }
    onChange([...links, { ...option, published: true, required: false, type }]);
  };

  const update = (id: string, required: boolean) =>
    onChange(
      links.map((link) => (link.id === id ? { ...link, required } : link))
    );

  return (
    <fieldset className="grid gap-3">
      <legend className="text-foreground mb-1 text-sm font-medium">
        Client content
      </legend>
      <p id="server-links-help" className="text-muted-foreground text-sm">
        Optional. Link a modpack, or any mix of mods, shaders, and resource
        packs, that players need or are recommended to install. With nothing
        linked, the server is listed as vanilla.
      </p>

      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor="server-link-type" className="sr-only">
            Project type to link
          </label>
          <Select
            items={SERVER_LINK_TYPES.map((value) => ({
              label: PROJECT_TYPE_LABELS[value].plural,
              value,
            }))}
            value={type}
            onValueChange={(value) => {
              if (isServerLinkTypeValue(value)) {
                setType(value);
                setQuery("");
              }
            }}
          >
            <SelectTrigger id="server-link-type" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVER_LINK_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PROJECT_TYPE_LABELS[value].plural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="server-link-search" className="sr-only">
            Search {PROJECT_TYPE_LABELS[type].plural.toLowerCase()} to link
          </label>
          <Combobox
            items={options}
            filteredItems={options}
            value={null}
            onValueChange={add}
            inputValue={query}
            onInputValueChange={setQuery}
            itemToStringLabel={(option: LinkOption) => option.name}
            isItemEqualToValue={(a: LinkOption, b: LinkOption) => a.id === b.id}
          >
            <ComboboxField
              id="server-link-search"
              placeholder={
                full
                  ? `Up to ${MAX_SERVER_LINKS} links`
                  : `Search published ${PROJECT_TYPE_LABELS[type].plural.toLowerCase()}`
              }
              disabled={full}
              aria-describedby="server-links-help"
            />
            <ComboboxContent>
              <ComboboxEmpty>
                No matching {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}.
              </ComboboxEmpty>
              <ComboboxList>
                {(option: LinkOption) => (
                  <ComboboxItem key={option.id} value={option}>
                    {option.name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      {links.length > 0 ? (
        <ul className="grid gap-2" aria-label="Linked content">
          {links.map((link) => (
            <li
              key={link.id}
              className="border-border bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {link.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {PROJECT_TYPE_LABELS[link.type].singular}
                  {link.published ? null : " · Hidden until it is published"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <label
                  htmlFor={`server-link-required-${link.id}`}
                  className="text-foreground flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm"
                >
                  <Checkbox
                    id={`server-link-required-${link.id}`}
                    checked={link.required}
                    onCheckedChange={(checked) => update(link.id, checked)}
                  />
                  Required to join
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="size-11"
                  aria-label={`Remove ${link.name}`}
                  onClick={() =>
                    onChange(links.filter((other) => other.id !== link.id))
                  }
                >
                  <IconX size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};

export const ServerForm = ({ onSaved, projectId, server }: ServerFormProps) => {
  const [address, setAddress] = useState(server?.address ?? "");
  const [port, setPort] = useState(server?.port ? String(server.port) : "");
  const [gameVersions, setGameVersions] = useState<string[]>(
    server?.gameVersions ?? []
  );
  const [links, setLinks] = useState<ServerLinkView[]>(server?.links ?? []);
  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.dismiss();

    const trimmedPort = port.trim();
    if (trimmedPort && !PORT_PATTERN.test(trimmedPort)) {
      setErrors(new Map([["port", "The port must be a whole number."]]));
      return;
    }

    const result = safeParse(serverInputSchema, {
      address,
      gameVersions,
      links: links.map((link) => ({
        projectId: link.id,
        required: link.required,
      })),
      port: trimmedPort ? Number(trimmedPort) : null,
      projectId,
    });
    if (!result.success) {
      setErrors(toFieldErrors(result.issues));
      return;
    }
    setErrors(NO_FIELD_ERRORS);

    setPending(true);
    try {
      await saveServerDetails({ data: result.output });
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the server."));
    }
    setPending(false);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-[1fr_10rem]">
        <FormField
          id="server-address"
          label="Server address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          error={errors.get("address")}
          helperText="The hostname or IP players connect to."
          placeholder="play.example.net"
          autoComplete="off"
          spellCheck={false}
          required
        />
        <FormField
          id="server-port"
          label="Port"
          inputMode="numeric"
          value={port}
          onChange={(event) => setPort(event.target.value)}
          error={errors.get("port")}
          helperText={`Leave empty for ${DEFAULT_SERVER_PORT}.`}
          placeholder={String(DEFAULT_SERVER_PORT)}
          autoComplete="off"
        />
      </div>

      <GameVersionPicker
        id="server-game-versions"
        label="Supported game versions"
        values={gameVersions}
        onChange={setGameVersions}
        error={errors.get("gameVersions")}
      />

      <LinkedContent
        links={links}
        onChange={setLinks}
        error={errors.get("links")}
      />

      <div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save server"}
        </Button>
      </div>
    </form>
  );
};
