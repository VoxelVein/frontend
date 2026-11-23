import type { ReactNode } from "react";

interface PageHeaderProps {
  /** A page-level action, such as a "New post" button, aligned to the title. */
  action?: ReactNode;
  description?: ReactNode;
  /** An optional leading mark, such as a project icon, beside the title. */
  icon?: ReactNode;
  title: string;
}

const PageHeader = ({ action, description, icon, title }: PageHeaderProps) => (
  <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div className="flex min-w-0 items-start gap-4">
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <div className="max-w-2xl">
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </header>
);

export { PageHeader };
