import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { safeParse } from "valibot";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { Button } from "@/components/ui/button";
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
import {
  CATEGORIES_BY_TYPE,
  isCategoryForType,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
  projectInputSchema,
  SLUG_MAX_LENGTH,
} from "@/lib/projects";
import type { ProjectInput, ProjectType } from "@/lib/projects";

export interface ProjectFormValues {
  category: string;
  description: string;
  name: string;
  slug: string;
  summary: string;
  tags: string;
  type: ProjectType;
}

interface ProjectFormProps {
  initialValues?: ProjectFormValues;
  /** Slug and type are fixed after creation. */
  mode: "create" | "edit";
  onSubmit: (input: ProjectInput) => Promise<void>;
  submitLabel: string;
}

const EMPTY_VALUES: ProjectFormValues = {
  category: "",
  description: "",
  name: "",
  slug: "",
  summary: "",
  tags: "",
  type: "mod",
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, SLUG_MAX_LENGTH);

const splitTags = (value: string): string[] => [
  ...new Set(
    value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  ),
];

const formatCategory = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ");

export const ProjectForm = ({
  initialValues = EMPTY_VALUES,
  mode,
  onSubmit,
  submitLabel,
}: ProjectFormProps) => {
  const [values, setValues] = useState(initialValues);
  // Once the slug is typed by hand, stop deriving it from the name.
  const slugEditedRef = useRef(mode === "edit");
  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update = <Key extends keyof ProjectFormValues>(
    key: Key,
    value: ProjectFormValues[Key]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const changeName = (name: string) =>
    setValues((current) => ({
      ...current,
      name,
      slug: slugEditedRef.current ? current.slug : slugify(name),
    }));

  const changeType = (type: ProjectType) =>
    setValues((current) => ({
      ...current,
      // Categories differ per type; keep the choice only if it still fits.
      category: isCategoryForType(type, current.category)
        ? current.category
        : "",
      type,
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = safeParse(projectInputSchema, {
      ...values,
      tags: splitTags(values.tags),
    });
    if (!result.success) {
      setErrors(toFieldErrors(result.issues));
      return;
    }
    setErrors(NO_FIELD_ERRORS);

    setPending(true);
    try {
      await onSubmit(result.output);
    } catch (error) {
      setFormError(errorMessage(error, "Could not save the project."));
    }
    setPending(false);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-6">
      {mode === "create" ? (
        <div className="grid gap-2">
          <label
            htmlFor="project-type"
            className="text-foreground text-sm font-medium"
          >
            Project type
          </label>
          <Select
            items={PROJECT_TYPES.map((type) => ({
              label: PROJECT_TYPE_LABELS[type].singular,
              value: type,
            }))}
            value={values.type}
            onValueChange={(value) => {
              if (value === "mod" || value === "plugin") {
                changeType(value);
              }
            }}
          >
            <SelectTrigger id="project-type" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {PROJECT_TYPE_LABELS[type].singular}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <FormField
        id="project-name"
        label="Name"
        value={values.name}
        onChange={(event) => changeName(event.target.value)}
        error={errors.get("name")}
        autoComplete="off"
        required
      />

      {mode === "create" ? (
        <FormField
          id="project-slug"
          label="URL slug"
          value={values.slug}
          onChange={(event) => {
            slugEditedRef.current = true;
            update("slug", event.target.value);
          }}
          error={errors.get("slug")}
          helperText={`Your page will live at /${values.type}s/${values.slug || "your-slug"}. It can't be changed later.`}
          autoComplete="off"
          spellCheck={false}
          required
        />
      ) : null}

      <div className="grid gap-2">
        <label
          htmlFor="project-category"
          className="text-foreground text-sm font-medium"
        >
          Category
        </label>
        <Select
          items={CATEGORIES_BY_TYPE[values.type].map((category) => ({
            label: formatCategory(category),
            value: category,
          }))}
          value={values.category}
          onValueChange={(value) => update("category", value ?? "")}
        >
          <SelectTrigger
            id="project-category"
            className="min-h-11 w-full"
            aria-invalid={errors.get("category") ? true : undefined}
            aria-describedby={
              errors.get("category") ? "project-category-error" : undefined
            }
          >
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES_BY_TYPE[values.type].map((category) => (
              <SelectItem key={category} value={category}>
                {formatCategory(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.get("category") ? (
          <p
            id="project-category-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {errors.get("category")}
          </p>
        ) : null}
      </div>

      <FormField
        id="project-summary"
        label="Summary"
        value={values.summary}
        onChange={(event) => update("summary", event.target.value)}
        error={errors.get("summary")}
        helperText="One sentence shown in search results."
        required
      />

      <FormTextarea
        id="project-description"
        label="Description (Markdown)"
        rows={10}
        value={values.description}
        onChange={(event) => update("description", event.target.value)}
        error={errors.get("description")}
        className="font-mono text-xs"
      />

      <FormField
        id="project-tags"
        label="Tags"
        value={values.tags}
        onChange={(event) => update("tags", event.target.value)}
        error={errors.get("tags")}
        helperText="Comma-separated, up to 8."
        autoComplete="off"
      />

      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
};
