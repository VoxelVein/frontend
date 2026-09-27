import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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
  errorMessage,
  NO_FIELD_ERRORS,
  toFieldErrors,
} from "@/lib/form-errors";
import type { FieldErrors } from "@/lib/form-errors";
import { searchProjects } from "@/lib/project-search.functions";
import { DEFAULT_SERVER_PORT, serverInputSchema } from "@/lib/projects";
import type { ProjectServerView } from "@/lib/projects";
import { saveServerDetails } from "@/lib/projects.functions";

interface ModpackOption {
  id: string;
  name: string;
}

interface ServerFormProps {
  onSaved: () => Promise<void> | void;
  projectId: string;
  server: ProjectServerView | null;
}

const PORT_PATTERN = /^\d+$/u;

/** Finds published modpacks by name while the user types. */
const useModpackSearch = (query: string): ModpackOption[] => {
  const [debounced] = useDebouncedValue(query, { wait: 250 });
  const [options, setOptions] = useState<ModpackOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let next: ModpackOption[] = [];
      try {
        const result = await searchProjects({
          data: { query: debounced, sort: "downloads:desc", type: "modpack" },
        });
        next = result.hits.map(({ id, name }) => ({ id, name }));
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
  }, [debounced]);

  return options;
};

export const ServerForm = ({ onSaved, projectId, server }: ServerFormProps) => {
  const [address, setAddress] = useState(server?.address ?? "");
  const [port, setPort] = useState(server?.port ? String(server.port) : "");
  const [gameVersions, setGameVersions] = useState<string[]>(
    server?.gameVersions ?? []
  );
  const [modpack, setModpack] = useState<ModpackOption | null>(
    server?.modpackId && server.modpack
      ? { id: server.modpackId, name: server.modpack.name }
      : null
  );
  const [modpackRequired, setModpackRequired] = useState(
    server?.modpackRequired ?? false
  );
  const [modpackQuery, setModpackQuery] = useState("");
  const modpackOptions = useModpackSearch(modpackQuery);
  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedPort = port.trim();
    if (trimmedPort && !PORT_PATTERN.test(trimmedPort)) {
      setErrors(new Map([["port", "The port must be a whole number."]]));
      return;
    }

    const result = safeParse(serverInputSchema, {
      address,
      gameVersions,
      modpackId: modpack?.id ?? null,
      modpackRequired,
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
      setFormError(errorMessage(error, "Could not save the server."));
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

      <fieldset className="grid gap-3">
        <legend className="text-foreground mb-2 text-sm font-medium">
          Modpack
        </legend>
        <label htmlFor="server-modpack" className="sr-only">
          Search modpacks
        </label>
        <Combobox
          items={modpackOptions}
          filteredItems={modpackOptions}
          value={modpack}
          onValueChange={(next: ModpackOption | null) => {
            setModpack(next);
            setModpackQuery("");
            if (!next) {
              setModpackRequired(false);
            }
          }}
          inputValue={modpackQuery}
          onInputValueChange={setModpackQuery}
          itemToStringLabel={(option: ModpackOption) => option.name}
          isItemEqualToValue={(a: ModpackOption, b: ModpackOption) =>
            a.id === b.id
          }
        >
          <ComboboxField
            id="server-modpack"
            placeholder={modpack ? modpack.name : "Search published modpacks"}
            className={modpack ? "placeholder:text-foreground" : undefined}
            aria-describedby="server-modpack-help"
          />
          <ComboboxContent>
            <ComboboxEmpty>No matching modpacks.</ComboboxEmpty>
            <ComboboxList>
              {(option: ModpackOption) => (
                <ComboboxItem key={option.id} value={option}>
                  {option.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <p id="server-modpack-help" className="text-muted-foreground text-sm">
          Optional. Link a modpack players need or are recommended to install.
        </p>

        {modpack ? (
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="server-modpack-required"
              className="text-foreground flex min-h-11 cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id="server-modpack-required"
                checked={modpackRequired}
                onCheckedChange={(checked) => setModpackRequired(checked)}
              />
              Players must install this modpack to join
            </label>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setModpack(null);
                setModpackRequired(false);
              }}
            >
              Remove modpack
            </Button>
          </div>
        ) : null}
      </fieldset>

      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save server"}
        </Button>
      </div>
    </form>
  );
};
