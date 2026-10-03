import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "cn";

const Combobox = ComboboxPrimitive.Root;

const ComboboxInput = ({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) => (
  <ComboboxPrimitive.Input
    data-slot="combobox-input"
    className={cn(
      "placeholder:text-muted-foreground min-h-9 min-w-24 flex-1 bg-transparent text-sm outline-none",
      className
    )}
    {...props}
  />
);

/** Bordered field that holds the chips and the input of a multi-select. */
const ComboboxChips = ({
  className,
  ...props
}: ComboboxPrimitive.Chips.Props) => (
  <ComboboxPrimitive.Chips
    data-slot="combobox-chips"
    className={cn(
      "border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:bg-input/30 flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1 transition-colors focus-within:ring-3",
      className
    )}
    {...props}
  />
);

const ComboboxChip = ({
  children,
  className,
  removeLabel,
  ...props
}: ComboboxPrimitive.Chip.Props & { removeLabel: string }) => (
  <ComboboxPrimitive.Chip
    data-slot="combobox-chip"
    className={cn(
      "bg-muted text-foreground data-highlighted:ring-ring/50 inline-flex items-center gap-0.5 rounded-md py-0.5 pl-2 text-xs font-medium outline-none data-highlighted:ring-2",
      className
    )}
    {...props}
  >
    {children}
    <ComboboxPrimitive.ChipRemove
      aria-label={removeLabel}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
    >
      <IconX size={12} aria-hidden="true" />
    </ComboboxPrimitive.ChipRemove>
  </ComboboxPrimitive.Chip>
);

/** Plain bordered field for a single-select combobox. */
const ComboboxField = ({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) => (
  <ComboboxPrimitive.Input
    data-slot="combobox-field"
    className={cn(
      "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 min-h-11 w-full rounded-lg border bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:ring-3",
      className
    )}
    {...props}
  />
);

const ComboboxContent = ({
  children,
  className,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset">) => (
  <ComboboxPrimitive.Portal>
    <ComboboxPrimitive.Positioner
      sideOffset={sideOffset}
      className="isolate z-50 outline-none"
    >
      <ComboboxPrimitive.Popup
        data-slot="combobox-content"
        className={cn(
          "bg-popover text-popover-foreground ring-foreground/10 max-h-[min(var(--available-height),20rem)] w-(--anchor-width) min-w-48 origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg border p-1 ring-1 outline-none",
          className
        )}
        {...props}
      >
        {children}
      </ComboboxPrimitive.Popup>
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
);

const ComboboxList = ComboboxPrimitive.List;

const ComboboxItem = ({
  children,
  className,
  ...props
}: ComboboxPrimitive.Item.Props) => (
  <ComboboxPrimitive.Item
    data-slot="combobox-item"
    className={cn(
      "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-11 cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-2 text-sm transition-colors duration-150 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
      <IconCheck size={16} aria-hidden="true" />
    </ComboboxPrimitive.ItemIndicator>
  </ComboboxPrimitive.Item>
);

const ComboboxEmpty = ({
  className,
  ...props
}: ComboboxPrimitive.Empty.Props) => (
  <ComboboxPrimitive.Empty
    data-slot="combobox-empty"
    className={cn(
      "text-muted-foreground px-2 py-3 text-sm empty:hidden",
      className
    )}
    {...props}
  />
);

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxField,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
};
