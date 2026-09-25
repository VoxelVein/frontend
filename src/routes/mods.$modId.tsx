import { IconArrowLeft, IconDownload, IconTag } from "@tabler/icons-react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";

import { StatCard } from "@/components/stat-card";
import { MODS } from "@/lib/mods-data";

const downloadFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const formatDownloads = (count: number) => downloadFormatter.format(count);

const badgeClassName =
  "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

const ModDetailPage = () => {
  const { modId } = useParams({ from: "/mods/$modId" });
  const mod = MODS.find((item) => item.id === modId);

  if (!mod) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          Mod not found
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The mod you are looking for does not exist or may have been removed.
        </p>
        <Link
          to="/mods"
          className="text-primary focus-visible:ring-ring mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconArrowLeft size={16} aria-hidden="true" />
          Back to mods
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <Link
        to="/mods"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        Back to mods
      </Link>

      <header className="mt-4 flex items-start gap-4 sm:gap-5">
        <div className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold sm:size-20 sm:text-3xl">
          {mod.name.charAt(0)}
        </div>

        <div className="min-w-0">
          <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
            {mod.category}
          </span>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {mod.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">by {mod.author}</p>
        </div>
      </header>

      <p className="text-muted-foreground mt-6 text-base leading-7">
        {mod.description}
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Downloads"
          value={
            <>
              <IconDownload size={16} aria-hidden="true" />
              {formatDownloads(mod.downloads)}
            </>
          }
        />

        <StatCard
          label="Version"
          value={
            <>
              <IconTag size={16} aria-hidden="true" />
              {mod.version}
            </>
          }
        />

        <StatCard label="Updated" value={mod.updatedAt} />

        <StatCard label="Loaders" value={mod.loaders.join(", ")} />
      </dl>

      <section aria-labelledby="game-versions-heading" className="mt-8">
        <h2
          id="game-versions-heading"
          className="text-foreground text-lg font-semibold"
        >
          Game versions
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {mod.gameVersions.map((version) => (
            <li key={version}>
              <span className={badgeClassName}>Minecraft {version}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tags-heading" className="mt-8">
        <h2 id="tags-heading" className="text-foreground text-lg font-semibold">
          Tags
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {mod.tags.map((tag) => (
            <li key={tag}>
              <span className={badgeClassName}>{tag}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export const Route = createFileRoute("/mods/$modId")({
  head: ({ params }) => {
    const mod = MODS.find((item) => item.id === params.modId);
    return {
      meta: [
        {
          title: mod ? `${mod.name} — VoxelVein` : "Mod not found — VoxelVein",
        },
      ],
    };
  },
  component: ModDetailPage,
});
