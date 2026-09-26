import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

const PrivacyPage = () => (
  <LegalPage
    title="Privacy Policy"
    updated="September 11, 2026"
    intro={
      <>
        This Privacy Policy explains how VoxelVein handles personal data when
        you use the platform.
      </>
    }
    sections={[
      {
        heading: "Data Controller",
        body: (
          <p>
            The data controller is Matéo Sauer, Dorfgasse 20, 99735 Kleinfurra,
            Germany. For any privacy-related request, contact
            mateo.sauer161013@gmail.com.
          </p>
        ),
      },
      {
        heading: "Data We Collect",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account data: username, email address, and password (stored as a
              secure hash) when you register.
            </li>
            <li>
              Authentication data: session identifiers and passkey credentials
              used to keep you signed in.
            </li>
            <li>
              Preferences: theme preference and cookie consent choices stored in
              your browser.
            </li>
            <li>
              Usage data: search queries and page interactions needed to operate
              the service.
            </li>
          </ul>
        ),
      },
      {
        heading: "How We Use Your Data",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>To provide and maintain your account and sessions.</li>
            <li>To authenticate you, including with passkeys.</li>
            <li>To operate, secure, and improve the platform.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        ),
      },
      {
        heading: "Legal Basis",
        body: (
          <p>
            We process personal data based on contract performance (providing
            the service), legitimate interest (security and improvement), and
            legal obligation where applicable.
          </p>
        ),
      },
      {
        heading: "Data Retention",
        body: (
          <p>
            Account data is retained while your account is active. You may
            delete your account at any time, after which we delete or anonymize
            your personal data unless we are legally required to retain it.
          </p>
        ),
      },
      {
        heading: "Your Rights",
        body: (
          <p>
            Depending on your jurisdiction (including the GDPR in the EU/EEA),
            you may have the right to access, rectify, erase, restrict, or port
            your personal data, and to object to processing. To exercise these
            rights, contact mateo.sauer161013@gmail.com.
          </p>
        ),
      },
      {
        heading: "Third-Party Services",
        body: (
          <p>
            The platform uses third-party services for search (Meilisearch),
            authentication (Better Auth), and hosting. These services may
            process data on our behalf under their own terms.
          </p>
        ),
      },
      {
        heading: "Changes to This Policy",
        body: (
          <p>
            We may update this Privacy Policy from time to time. Material
            changes will be announced on the platform.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — VoxelVein" }],
  }),
  component: PrivacyPage,
});
