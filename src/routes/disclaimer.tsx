import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

/**
 * Two notes that are read on their own, not a second set of terms.
 *
 * This page used to restate the warranty disclaimer and the liability cap that
 * `/terms` already covers, in slightly different words, so the two pages could
 * be read against each other and neither was clearly the operative one. It now
 * carries only what it adds — the trademark position and a caution about
 * user-submitted metadata — and links to the Terms for everything binding.
 */
const DisclaimerPage = () => (
  <LegalPage
    title="Disclaimer"
    updated="September 11, 2026"
    intro={
      <>
        These notes sit alongside our{" "}
        <Link to="/terms" className="text-primary underline underline-offset-4">
          Terms of Service
        </Link>
        , which are what you are agreeing to when you use VoxelVein. Where the
        two overlap, the Terms apply.
      </>
    }
    sections={[
      {
        heading: "Not Affiliated with Mojang or Microsoft",
        body: (
          <p>
            VoxelVein is an independent, community-driven project. It is not
            affiliated with, endorsed by, or sponsored by Mojang Studios or
            Microsoft. &ldquo;Minecraft&rdquo; is a trademark of Mojang
            Synergies AB.
          </p>
        ),
      },
      {
        heading: "Project Descriptions Are the Author's",
        body: (
          <p>
            Project names, descriptions, download counts, and version histories
            on VoxelVein are supplied by the people who publish them. We host
            and display them; we do not write or verify them. A project listed
            here has not necessarily been tested by us, and a download count is
            whatever its author&rsquo;s publishing tool reported. Check the
            files yourself before you run them.
          </p>
        ),
      },
      {
        heading: "External Links",
        body: (
          <p>
            Projects often link to the author&rsquo;s own site, a wiki, or a
            source repository. We do not control those destinations and are not
            responsible for what they serve.
          </p>
        ),
      },
      {
        heading: "Warranties and Liability",
        body: (
          <p>
            VoxelVein provides the site &ldquo;as is,&rdquo; and we limit our
            liability as set out in the{" "}
            <Link
              to="/terms"
              className="text-primary underline underline-offset-4"
            >
              Terms of Service
            </Link>
            . We cannot guarantee that the site is uninterrupted or that any
            project will work on your setup.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/disclaimer")({
  head: () => ({
    meta: [{ title: "Disclaimer | VoxelVein" }],
  }),
  component: DisclaimerPage,
});
