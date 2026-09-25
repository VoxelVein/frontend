import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

const OPERATOR = {
  name: "Matéo Sauer",
  address: "Dorfgasse 20, 99735 Kleinfurra, Germany",
  email: "mateo.sauer161013@gmail.com",
};

const LegalNotesPage = () => (
  <LegalPage
    title="Legal Notes"
    updated="September 11, 2026"
    intro={
      <>
        Legal information about the operator of VoxelVein in accordance with § 5
        DDG (German Digital Services Act).
      </>
    }
    sections={[
      {
        heading: "Service Provider",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Name: {OPERATOR.name}</li>
            <li>Address: {OPERATOR.address}</li>
            <li>Email: {OPERATOR.email}</li>
          </ul>
        ),
      },
      {
        heading: "Responsible for Content",
        body: (
          <p>
            Responsible for the content of this platform: {OPERATOR.name},{" "}
            {OPERATOR.address}.
          </p>
        ),
      },
      {
        heading: "Liability for Content",
        body: (
          <p>
            As a service provider, we are responsible for our own content on
            these pages in accordance with general laws. We are not obligated to
            monitor transmitted or stored third-party information or to
            investigate circumstances that indicate illegal activity.
          </p>
        ),
      },
      {
        heading: "Liability for User Content",
        body: (
          <p>
            Content uploaded by users is not governed by VoxelVein. Users are
            solely responsible for the content they upload. If a user uploads
            malicious software (malware) or other unlawful content without our
            knowledge, and no one reports it, VoxelVein is not liable for it.
            The user who uploaded the content, as well as users who were aware
            of it but did not report it, bear responsibility for such content.
          </p>
        ),
      },
      {
        heading: "Liability for Links",
        body: (
          <p>
            Our platform contains links to external third-party websites over
            whose content we have no influence. The respective provider or
            operator of the linked pages is always responsible for their
            content.
          </p>
        ),
      },
      {
        heading: "Copyright",
        body: (
          <p>
            The content and works created by the platform operators on these
            pages are subject to copyright. Third-party contributions are
            identified as such.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [{ title: "Legal Notes — VoxelVein" }],
  }),
  component: LegalNotesPage,
});
