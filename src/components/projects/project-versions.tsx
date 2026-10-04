import { IconDownload, IconVersions } from "@tabler/icons-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { MICRO_LABEL_CLASS, PILL_CLASS } from "@/lib/classes";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import { hasLoaders, LOADER_LABELS } from "@/lib/projects";
import type { ProjectVersionView, ProjectView } from "@/lib/projects";

/**
 * A short factual value as a chip, or a note when there is none.
 *
 * An empty compatibility list is information — "we don't know what this supports"
 * and "this supports nothing" are different answers — so it gets words rather
 * than an empty row.
 */
const ValuePills = ({ label, values }: { label: string; values: string[] }) => (
  <>
    <p className={MICRO_LABEL_CLASS}>{label}</p>
    {values.length > 0 ? (
      <ul className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <li className={PILL_CLASS} key={value}>
            {value}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-muted-foreground mt-2 text-sm">Not specified.</p>
    )}
  </>
);

/**
 * One version's files, the first of which the owner marked primary.
 *
 * Files arrive ordered primary-first (`projects.functions` orders by
 * `desc(primary)`), so index zero is the one to feature.
 */
const DownloadLinks = ({ version }: { version: ProjectVersionView }) => {
  const [primary, ...others] = version.files;

  if (primary === undefined) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        This version has no files attached.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {/* A real anchor to the download endpoint, not a button with a click
          handler: the endpoint 302s to a signed storage URL, so middle-click,
          right-click-save, and "open in new tab" all have to keep working. A
          `download` attribute would be ignored across the redirect.

          The name goes on the anchor rather than on `Button` because that is the
          element React actually renders, and it is the one the linter and the
          accessibility tree both read. Without the filename a screen reader
          announces the same word for every version and the reader cannot tell
          two files apart; it leads with the visible label so the name stays a
          superset of what is on screen. */}
      <Button
        className="min-h-12 w-full gap-2 text-base"
        render={
          <a
            aria-label={`Download ${primary.filename}`}
            href={`/api/download/${primary.id}`}
          />
        }
      >
        <IconDownload aria-hidden="true" size={18} />
        Download
      </Button>

      <p className="text-muted-foreground mt-2 text-xs break-all">
        {primary.filename} · {formatBytes(primary.size)}
      </p>

      {/* A version can carry several files. Only the primary one is worth a
          button; the rest sit under it as plain links so the panel answers
          "what can I get?" completely without crowding the primary action. */}
      {others.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {others.map((file) => (
            <li key={file.id}>
              <a
                className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                href={`/api/download/${file.id}`}
              >
                <IconDownload aria-hidden="true" size={14} />
                <span className="break-all">{file.filename}</span>
                <span className="text-muted-foreground">
                  · {formatBytes(file.size)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

/**
 * What the newest version needs: the loaders or platforms it runs on, and the
 * Minecraft versions it targets.
 *
 * The loaders block is omitted entirely for resource packs and datapacks,
 * which have no such axis — `hasLoaders` is the same predicate the publish form
 * and the browse filters use, so a type that stops needing loaders loses the
 * block here too.
 */
const Compatibility = ({
  project,
  version,
}: {
  project: ProjectView;
  version: ProjectVersionView;
}) => (
  <div className="border-border bg-card rounded-xl border p-5">
    {hasLoaders(project.type) ? (
      <ValuePills
        label={LOADER_LABELS[project.type].plural}
        values={version.loaders}
      />
    ) : null}

    <div className={hasLoaders(project.type) ? "mt-5" : undefined}>
      <ValuePills label="Minecraft version" values={version.gameVersions} />
    </div>
  </div>
);

/**
 * The sidebar that answers "can I use this, and how do I get it?".
 *
 * The download action leads the page in DOM order, exactly as the server page's
 * join panel does. Before this the versions table was the last thing on the
 * screen, under the description and the gallery — a visitor who came to install
 * a mod had to scroll past everything else to find the file.
 */
const ProjectDownloadPanel = ({ project }: { project: ProjectView }) => {
  const [latest] = project.versions;

  return (
    <section aria-labelledby="download-panel-heading" className="grid gap-4">
      <h2
        className="text-foreground flex items-center gap-2 text-lg font-semibold"
        id="download-panel-heading"
      >
        <IconDownload aria-hidden="true" size={20} />
        Download
      </h2>

      {latest === undefined ? (
        <EmptyState
          description="Nothing has been published yet. Check back once the owner releases a version."
          icon={<IconVersions aria-hidden="true" size={24} />}
          title="No versions yet"
          variant="inline"
        />
      ) : (
        <>
          <div className="border-border bg-card rounded-xl border p-5">
            <p className={MICRO_LABEL_CLASS}>Latest version</p>
            <p className="text-foreground mt-2 text-2xl font-bold tracking-tight">
              {latest.versionNumber}
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm capitalize">
              {latest.channel} · {formatDate(latest.createdAt)}
            </p>

            <DownloadLinks version={latest} />

            {/* The lifetime count, next to the button that moves it. A download
                total is only interesting in relation to the act of downloading. */}
            <div className="border-border mt-5 border-t pt-4">
              <p className={MICRO_LABEL_CLASS}>Downloads</p>
              <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
                {formatCount(project.downloads)}
              </p>
            </div>
          </div>

          <Compatibility project={project} version={latest} />
        </>
      )}
    </section>
  );
};

/**
 * Every version, newest first, with each version's files.
 *
 * Real `<table>` markup rather than a grid of divs: this is tabular data with
 * row and column headers, which is what a screen reader needs to announce
 * "Sodium 0.6.0, Fabric, released Sep 20" when moving cell by cell.
 */
const VersionsTable = ({ versions }: { versions: ProjectVersionView[] }) => {
  if (versions.length === 0) {
    return (
      <EmptyState
        description="No downloads available yet. This project is still being set up — check back soon."
        icon={<IconVersions size={24} aria-hidden="true" />}
        title="No versions yet"
        variant="inline"
      />
    );
  }

  return (
    <div className="border-border mt-3 overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Versions, newest first, with their downloadable files
        </caption>
        <thead className="bg-muted/50 text-muted-foreground text-xs tracking-wide uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Version
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Compatibility
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Released
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Files
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {versions.map((version) => (
            <tr key={version.id} className="align-top">
              <th scope="row" className="px-4 py-3 font-medium">
                <span className="text-foreground block">
                  {version.versionNumber}
                </span>
                <span className="text-muted-foreground block text-xs font-normal capitalize">
                  {version.channel}
                </span>
              </th>
              <td className="text-muted-foreground px-4 py-3">
                <span className="block capitalize">
                  {version.loaders.join(", ")}
                </span>
                <span className="block text-xs">
                  {version.gameVersions.join(", ")}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                {formatDate(version.createdAt)}
              </td>
              <td className="px-4 py-3">
                <ul className="flex flex-col gap-2">
                  {version.files.map((file) => (
                    <li key={file.id}>
                      <a
                        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        href={`/api/download/${file.id}`}
                      >
                        <IconDownload size={16} aria-hidden="true" />
                        <span>
                          Download{" "}
                          <span className="sr-only">{file.filename}</span>
                        </span>
                      </a>
                      <span className="text-muted-foreground block text-xs break-all">
                        {file.filename} · {formatBytes(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * The full release history.
 *
 * Titled "Version history" rather than "Versions" because the sidebar now shows
 * the latest version: two sections both called "Versions" on one page reads as a
 * duplicate, and the table is the past, not the present.
 */
const ProjectVersionHistory = ({ project }: { project: ProjectView }) => (
  <section aria-labelledby="version-history-heading">
    <h2
      className="text-foreground text-lg font-semibold"
      id="version-history-heading"
    >
      Version history
    </h2>
    <VersionsTable versions={project.versions} />
  </section>
);

export { ProjectDownloadPanel, ProjectVersionHistory };
