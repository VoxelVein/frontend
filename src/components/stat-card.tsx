import type { ReactNode } from "react";

import { MICRO_LABEL_CLASS } from "@/lib/classes";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}

const StatCard = ({ icon, label, value }: StatCardProps) => (
  <div className="border-border bg-card rounded-xl border p-4">
    <dt className={MICRO_LABEL_CLASS}>{label}</dt>
    <dd className="text-foreground mt-1 flex items-center gap-1.5 text-lg font-semibold">
      {icon}
      {value}
    </dd>
  </div>
);

export { StatCard };
