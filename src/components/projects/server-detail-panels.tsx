import {
  IconCheck,
  IconCopy,
  IconDeviceGamepad,
  IconPackage,
  IconPlugConnected,
  IconVersions,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import { IconSwap } from "@/components/motion/icon-swap";
import { ProjectLink } from "@/components/projects/project-link";
import { Button } from "@/components/ui/button";
import { MICRO_LABEL_CLASS } from "@/lib/classes";
import { formatServerAddress } from "@/lib/projects";
import type { ProjectServerView, ServerLinkView } from "@/lib/projects";
import { cn } from "@/lib/utils";

/** How long the copied state holds before the address label resets. */
const COPIED_RESET_MS = 2000;

/**
 * What the live region says for each copy state.
 *
 * A `Record` rather than a nested ternary in the markup: the empty string for
 * `idle` is what `empty:hidden` collapses, and putting the three strings side by
 * side here makes the missing one obvious.
 */
const COPY_MESSAGES: Record<"idle" | "copied" | "failed", string> = {
  copied: "Address copied to your clipboard.",
  // The address is `select-all` above, so this is a real instruction and not a
  // dead end.
  failed: "Could not copy. Select the address above and copy it manually.",
  idle: "",
};

/**
 * The join address, and the button that copies it.
 *
 * This is the reason a server page exists, so it gets the largest type on the
 * page and sits above the description rather than below it. The old layout put
 * it in a "Join" section under the fold, below the stats, summary, and
 * description — the one thing a visitor came for was the last thing on screen.
 *
 * The address is `select-all` as well as copyable, because the clipboard write
 * can fail (an insecure origin, a denied permission) and selecting the text is
 * the fallback that always works. The failure message says so.
 */
const ServerAddress = ({ server }: { server: ProjectServerView }) => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear on unmount: the timer otherwise outlives the component and React
  // warns about setting state on something that is gone.
  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    },
    []
  );

  const address = formatServerAddress(server.address, server.port);

  const copy = async () => {
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current);
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    resetTimer.current = setTimeout(
      () => setCopyState("idle"),
      COPIED_RESET_MS
    );
  };

  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <p className={MICRO_LABEL_CLASS}>Server address</p>

      <p className="text-foreground mt-2 font-mono text-lg break-all select-all sm:text-xl">
        {address}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* The variant stays put on purpose. Tinting the button on success read
            as much like "this control is now unavailable" as it did like
            confirmation, and the tick plus the label already say what happened. */}
        <Button className="min-h-11" type="button" onClick={() => copy()}>
          {/* The icon carries the result as a shape as well as a word, which
              reads faster than the label change alone. */}
          <IconSwap value={copyState}>
            {copyState === "copied" ? (
              <IconCheck size={16} aria-hidden="true" />
            ) : (
              <IconCopy size={16} aria-hidden="true" />
            )}
          </IconSwap>
          {copyState === "copied" ? "Copied" : "Copy address"}
        </Button>

        {/* Separate from the button on purpose: a button that renames itself is
            not reliably announced, so a copy that silently succeeds would leave
            a screen reader user with no confirmation at all. */}
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm empty:hidden"
        >
          {COPY_MESSAGES[copyState]}
        </p>
      </div>
    </div>
  );
};

/**
 * The Minecraft versions a server accepts.
 *
 * Pills rather than the comma-separated sentence the old page used. A version
 * is something a player matches against their own launcher, so it has to be
 * scannable at a glance — "can I join with what I have?" is the question, and
 * reading a run of text does not answer it.
 */
const ServerVersions = ({ versions }: { versions: string[] }) => {
  if (versions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No supported versions listed yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {versions.map((version) => (
        <li
          className="border-border bg-muted text-foreground inline-flex items-center rounded-full border px-3 py-1 font-mono text-sm"
          key={version}
        >
          {version}
        </li>
      ))}
    </ul>
  );
};

/**
 * One linked mod, pack, shader, or datapack a player may need before joining.
 *
 * `required` is carried in the type rather than read from the parent, because
 * "required" changes the badge and the wording and the two must not drift.
 */
const ServerLinkRow = ({ link }: { link: ServerLinkView }) => (
  <li className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
    <div className="flex min-w-0 items-center gap-3">
      <IconPackage
        aria-hidden="true"
        className="text-muted-foreground shrink-0"
        size={20}
      />
      <div className="min-w-0">
        <p className="text-foreground font-medium">{link.name}</p>
        <p className="text-muted-foreground text-sm">
          {link.required ? "Required to join" : "Recommended"}
        </p>
      </div>
    </div>

    {/* An unpublished link would 404 for anyone but its owner, so it renders as
        plain text instead of a link pointing at a page that does not exist. */}
    {link.published ? (
      <ProjectLink
        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        slug={link.slug}
        type={link.type}
      >
        View project
        <span className="sr-only"> {link.name}</span>
      </ProjectLink>
    ) : (
      <span className="text-muted-foreground px-3 text-sm">
        Not published yet
      </span>
    )}
  </li>
);

/**
 * What a player must install on their own client before joining.
 *
 * Split into required and recommended because they are not the same kind of
 * instruction: skipping a required mod means you cannot get in, skipping a
 * recommended one costs you fidelity. The old page showed one flat list with
 * "Required"/"Recommended" as body text, which put the distinction in the
 * least noticeable place on the card.
 */
const ServerRequirements = ({ server }: { server: ProjectServerView }) => {
  const required = server.links.filter((link) => link.required);
  const recommended = server.links.filter((link) => !link.required);

  if (server.links.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing to install. Join with a vanilla Minecraft client.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {required.length > 0 ? (
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            Required to join
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Install these first, or the server will refuse your connection.
          </p>
          <ul className="mt-3 grid gap-2">
            {required.map((link) => (
              <ServerLinkRow key={link.id} link={link} />
            ))}
          </ul>
        </div>
      ) : null}

      {recommended.length > 0 ? (
        <div>
          <h3 className="text-foreground text-sm font-semibold">Recommended</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Optional. The server works without them.
          </p>
          <ul className="mt-3 grid gap-2">
            {recommended.map((link) => (
              <ServerLinkRow key={link.id} link={link} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The panel that answers "can I play here, and how do I get in?".
 *
 * Three questions in the order a player asks them: what the address is, whether
 * their version is supported, and what they need to install first. Everything
 * else on the page is context for a decision this panel already settled.
 *
 * The `h2` is not decoration. The requirement groups below it are `h3`s, so
 * without a heading of their own to sit under they would jump straight from the
 * page's `h1` — a broken outline for anyone navigating by heading. It also
 * names the column, which is what makes a two-column page legible: this side is
 * how to join, the other side is what the server is.
 */
const ServerJoinPanel = ({ server }: { server: ProjectServerView | null }) => {
  const heading = (
    <h2
      className="text-foreground flex items-center gap-2 text-lg font-semibold"
      id="join-panel-heading"
    >
      <IconPlugConnected aria-hidden="true" size={20} />
      Join this server
    </h2>
  );

  if (server === null) {
    return (
      <section aria-labelledby="join-panel-heading" className="grid gap-4">
        {heading}
        <div className="border-border bg-card rounded-xl border p-5">
          <p className={MICRO_LABEL_CLASS}>Server address</p>
          <p className="text-muted-foreground mt-2 text-sm">
            The owner has not published an address for this server yet. Check
            back later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="join-panel-heading" className="grid gap-4">
      {heading}
      <ServerAddress server={server} />

      <div className="border-border bg-card rounded-xl border p-5">
        {/* A `p` micro label, not a heading: this card's content is a list of
            versions, and promoting it would put an `h3` between the panel's
            `h2` and the requirement `h3`s that follow, reading as a sibling of
            them rather than a peer card. */}
        <p className={cn(MICRO_LABEL_CLASS, "flex items-center gap-1.5")}>
          <IconVersions aria-hidden="true" size={14} />
          Supported versions
        </p>
        <div className="mt-3">
          <ServerVersions versions={server.gameVersions} />
        </div>
      </div>

      <div className="border-border bg-card rounded-xl border p-5">
        <p className={cn(MICRO_LABEL_CLASS, "flex items-center gap-1.5")}>
          <IconDeviceGamepad aria-hidden="true" size={14} />
          Before you join
        </p>
        <div className="mt-3">
          <ServerRequirements server={server} />
        </div>
      </div>
    </section>
  );
};

export { ServerJoinPanel, ServerLinkRow, ServerRequirements, ServerVersions };
