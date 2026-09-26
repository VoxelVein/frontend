import { cn } from "cn";
import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: string;
  /**
   * `default` is page scale: centred stack with generous margins.
   * `inline` is for use inside a card, panel, or list region, where the
   * default's margins and heading size would dominate the surrounding
   * content. It renders as a bordered, self-contained block.
   */
  variant?: "default" | "inline";
}

const EmptyState = ({
  action,
  description,
  icon,
  title,
  variant = "default",
}: EmptyStateProps) => {
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        isInline
          ? "border-border bg-muted/40 mt-4 rounded-lg border p-6 text-center"
          : "mt-16 flex flex-col items-center text-center"
      )}
    >
      {icon ? (
        <div
          className={cn(
            "border-border text-muted-foreground flex items-center justify-center rounded-xl border",
            isInline
              ? "bg-background mx-auto mb-3 size-11"
              : "bg-muted mb-4 size-12"
          )}
        >
          {icon}
        </div>
      ) : null}
      <p
        className={cn(
          "text-foreground",
          isInline ? "text-sm font-medium" : "text-lg font-semibold"
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};

export { EmptyState };
