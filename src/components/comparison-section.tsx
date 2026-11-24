import { Reveal } from "@/components/reveal";
import { staggerDelay } from "@/lib/reveal-stagger";
import { cn } from "@/lib/utils";

/**
 * Estimates, not measured benchmarks: library and community figures are
 * deliberately conservative because we are still small. Revisit these when a
 * release changes what the platform can actually do.
 */
const RIVALS = [
  { label: "Modrinth", points: 96, tone: "muted" },
  { label: "BuiltByBit", points: 82, tone: "muted" },
  { label: "VoxelVein", points: 28, tone: "primary" },
] as const;

const ROWS = [
  { label: "Content library", modrinth: 96, builtByBit: 82, voxelVein: 6 },
  { label: "Creator community", modrinth: 98, builtByBit: 88, voxelVein: 7 },
  { label: "Mod tooling", modrinth: 94, builtByBit: 76, voxelVein: 44 },
  { label: "Open source", modrinth: 90, builtByBit: 10, voxelVein: 98 },
] as const;

const ScoreBar = ({
  label,
  value,
  tone,
  delay,
}: {
  label: string;
  tone: "muted" | "primary";
  value: number;
  delay: number;
}) => (
  <Reveal delay={delay} className="min-w-0">
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-24 shrink-0 text-xs font-medium">
        {label}
      </span>
      <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
        <div
          aria-hidden="true"
          className={cn(
            "comparison-score-fill h-full rounded-full",
            tone === "primary" ? "bg-primary" : "bg-muted-foreground/40"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">
        {value}
      </span>
    </div>
  </Reveal>
);

export const ComparisonSection = () => (
  <section
    aria-labelledby="comparison-heading"
    className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <div className="mx-auto max-w-7xl">
      <Reveal>
        <h2
          id="comparison-heading"
          className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          How we compare
        </h2>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base">
          Modrinth and BuiltByBit still have years, contributors, and libraries
          we do not. We now serve all seven project types, and the tooling row
          reflects what shipped since launch: version management, disclosures,
          image cropping, and a shared editor. The library and community numbers
          stay deliberately modest.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {RIVALS.map((rival, index) => (
          <ScoreBar
            key={rival.label}
            label={rival.label}
            tone={rival.tone}
            value={rival.points}
            delay={staggerDelay(index)}
          />
        ))}
      </div>

      <Reveal delay={staggerDelay(RIVALS.length)} className="mt-10">
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Aspect</th>
                <th className="px-4 py-3 font-medium">Modrinth</th>
                <th className="px-4 py-3 font-medium">BuiltByBit</th>
                <th className="px-4 py-3 font-medium">VoxelVein</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {row.modrinth}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {row.builtByBit}
                  </td>
                  <td className="text-foreground px-4 py-3 font-semibold tabular-nums">
                    {row.voxelVein}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={staggerDelay(RIVALS.length + 1)}>
        <p className="text-muted-foreground mt-6 max-w-2xl text-sm sm:text-base">
          Those scores are today&apos;s. We are{" "}
          <strong className="text-foreground font-semibold">moving fast</strong>
          : every release adds features, content types, and polish, and the gap
          between us and the incumbents keeps shrinking. Join us early and help
          shape what this platform becomes.
        </p>
      </Reveal>
    </div>
  </section>
);
