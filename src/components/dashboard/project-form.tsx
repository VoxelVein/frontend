import { useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { safeParse } from "valibot";

import { ProjectDisclosures } from "@/components/dashboard/project-disclosures";
import { FormField } from "@/components/form-field";
import { MarkdownEditor } from "@/components/markdown-editor";
import { RequiredLabel } from "@/components/required-label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  errorMessage,
  NO_FIELD_ERRORS,
  toFieldErrors,
} from "@/lib/form-errors";
import type { FieldErrors } from "@/lib/form-errors";
import { formatCategory } from "@/lib/format";
import {
  CATEGORIES_BY_TYPE,
  isCategoryForType,
  isProjectType,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
  PROJECT_TYPES,
  projectInputSchema,
  SLUG_MAX_LENGTH,
} from "@/lib/projects";
import type {
  ProjectDisclosure,
  ProjectInput,
  ProjectType,
} from "@/lib/projects";
import { cn } from "@/lib/utils";

export interface ProjectFormValues {
  category: string;
  description: string;
  disclosures: ProjectDisclosure[];
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
  disclosures: [],
  name: "",
  slug: "",
  summary: "",
  tags: "",
  type: "mod",
};

const FIELD_WIDTH = "max-w-2xl";
const OTHER_CATEGORY = "__other__";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+/gu, "")
    .replaceAll(/-+$/gu, "")
    .slice(0, SLUG_MAX_LENGTH);

const splitTags = (value: string): string[] => [
  ...new Set(
    value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
  ),
];

const FormSection = ({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) => (
  <fieldset className="border-border grid gap-4 border-b pb-8 last:border-0 last:pb-0">
    <legend className="text-foreground text-base font-semibold">{title}</legend>
    <p className="text-muted-foreground -mt-2 text-sm">{description}</p>
    {children}
  </fieldset>
);

export const ProjectForm = ({
  initialValues = EMPTY_VALUES,
  mode,
  onSubmit,
  submitLabel,
}: ProjectFormProps) => {
  const [values, setValues] = useState(initialValues);

  const [categoryIsCustom, setCategoryIsCustom] = useState(
    Boolean(initialValues.category) &&
      !isCategoryForType(initialValues.type, initialValues.category)
  );

  const [customCategory, setCustomCategory] = useState(initialValues.category);
  // Once the slug is typed by hand, stop deriving it from the name.
  const slugEditedRef = useRef(mode === "edit");
  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
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

  const changeType = (type: ProjectType) => {
    setValues((current) => ({
      ...current,
      category: isCategoryForType(type, current.category)
        ? current.category
        : "",
      type,
    }));
    setCategoryIsCustom(false);
    setCustomCategory("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.dismiss();

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
      toast.error(errorMessage(error, "Could not save the project."));
    }

    setPending(false);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-8">
      <FormSection
        title="Project identity"
        description="The name people search for and the address where your listing lives."
      >
        {mode === "create" ? (
          <div className="grid gap-2">
            <RequiredLabel htmlFor="project-type" isRequired>
              Project type
            </RequiredLabel>
            <Select
              items={PROJECT_TYPES.map((type) => ({
                label: PROJECT_TYPE_LABELS[type].singular,
                value: type,
              }))}
              value={values.type}
              onValueChange={(value) => {
                if (value && isProjectType(value)) {
                  changeType(value);
                }
              }}
            >
              <SelectTrigger
                id="project-type"
                className={cn("min-h-11 w-full", FIELD_WIDTH)}
              >
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
            <p className="text-muted-foreground text-sm">
              A project keeps the type it was created with.
            </p>
          </div>
        ) : null}

        <FormField
          id="project-name"
          label="Name"
          className={FIELD_WIDTH}
          value={values.name}
          onChange={(event) => changeName(event.target.value)}
          error={errors.get("name")}
          helperText="Keep it recognizable in search results."
          autoComplete="off"
          required
        />

        <FormField
          id="project-slug"
          label="URL slug"
          className={FIELD_WIDTH}
          value={values.slug}
          onChange={(event) => {
            slugEditedRef.current = true;
            update("slug", event.target.value);
          }}
          error={errors.get("slug")}
          helperText={
            mode === "create"
              ? `Your page will live at ${PROJECT_TYPE_PATHS[values.type]}/${values.slug || "your-slug"}.`
              : `Your page lives at ${PROJECT_TYPE_PATHS[values.type]}/${values.slug || "your-slug"}. Changing it updates the URL and any links to the old address.`
          }
          autoComplete="off"
          spellCheck={false}
          required
        />

        <div className="grid max-w-2xl gap-2">
          <RequiredLabel htmlFor="project-category" isRequired>
            Category
          </RequiredLabel>
          <Select
            items={[
              ...CATEGORIES_BY_TYPE[values.type].map((category) => ({
                label: formatCategory(category),
                value: category,
              })),
              { label: "Other…", value: OTHER_CATEGORY },
            ]}
            value={categoryIsCustom ? OTHER_CATEGORY : values.category}
            onValueChange={(value) => {
              const custom = value === OTHER_CATEGORY;
              setCategoryIsCustom(custom);

              if (!custom) {
                setCustomCategory("");
                update("category", value ?? "");

                return;
              }

              const nextCustom = categoryIsCustom ? customCategory : "";
              setCustomCategory(nextCustom);
              update("category", nextCustom);
            }}
          >
            <SelectTrigger
              id="project-category"
              className={cn("min-h-11 w-full", FIELD_WIDTH)}
              aria-invalid={errors.get("category") ? true : undefined}
              aria-describedby={
                errors.get("category") && !categoryIsCustom
                  ? "project-category-error"
                  : undefined
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
              <SelectItem value={OTHER_CATEGORY}>Other…</SelectItem>
            </SelectContent>
          </Select>
          {categoryIsCustom ? (
            <FormField
              id="project-custom-category"
              label="Your category"
              value={customCategory}
              onChange={(event) => {
                const next = event.target.value;
                setCustomCategory(next);
                update("category", next);
              }}
              error={errors.get("category")}
              helperText="This category will also appear in the category filter."
              maxLength={40}
              required
            />
          ) : null}
          {!categoryIsCustom && errors.get("category") ? (
            <p
              id="project-category-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {errors.get("category")}
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title="Listing details"
        description="The short description and tags people use to decide whether to open your project."
      >
        <FormField
          id="project-summary"
          label="Summary"
          className={FIELD_WIDTH}
          value={values.summary}
          onChange={(event) => update("summary", event.target.value)}
          error={errors.get("summary")}
          helperText="One sentence shown in search results and on project cards."
          required
        />

        <FormField
          id="project-tags"
          label="Tags"
          className={FIELD_WIDTH}
          value={values.tags}
          onChange={(event) => update("tags", event.target.value)}
          error={errors.get("tags")}
          helperText="Comma-separated, up to 8. Use the terms people search for."
          autoComplete="off"
        />
      </FormSection>

      <FormSection
        title="Description"
        description="Explain what the project does, how to install it, and anything people should know before downloading."
      >
        <MarkdownEditor
          id="project-description"
          label="Description (Markdown)"
          rows={14}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          error={errors.get("description")}
          helperText="Markdown is supported. The preview uses the same renderer as the public page."
          previewEmptyMessage="Your description will appear here as you type."
          previewMaxHeightClassName="max-h-[30rem] min-h-56"
        />
      </FormSection>

      <FormSection
        title="Disclosures"
        description="Optional notes about how the project was made, what it relies on, or whether it is still maintained."
      >
        <ProjectDisclosures
          disclosures={values.disclosures}
          error={errors.get("disclosures")}
          onChange={(disclosures) => update("disclosures", disclosures)}
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? (
            <>
              <Spinner label="Saving project" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <p className="text-muted-foreground text-sm">
          {mode === "create"
            ? "Your project starts as a draft. Add a version before publishing."
            : "Changes go live immediately for published projects."}
        </p>
      </div>
    </form>
  );
};
