import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

const TermsPage = () => (
  <LegalPage
    title="Terms of Service"
    updated="September 11, 2026"
    intro={
      <>These Terms of Service govern your use of the VoxelVein platform.</>
    }
    sections={[
      {
        heading: "Acceptance of Terms",
        body: (
          <p>
            By accessing or using VoxelVein, you agree to be bound by these
            Terms. If you do not agree, you must not use the platform.
          </p>
        ),
      },
      {
        heading: "Description of Service",
        body: (
          <p>
            VoxelVein is an open-source marketplace for discovering, sharing,
            and managing community-created Minecraft content, including mods,
            resource packs, modpacks, shaders, plugins, and servers.
          </p>
        ),
      },
      {
        heading: "Accounts",
        body: (
          <p>
            Some features require an account. You are responsible for
            safeguarding your credentials and for all activity under your
            account. You must provide accurate information when registering.
          </p>
        ),
      },
      {
        heading: "Acceptable Use",
        body: (
          <p>
            You agree not to misuse the platform, including attempting to
            disrupt the service, accessing areas you are not authorized to
            access, or uploading unlawful or infringing content.
          </p>
        ),
      },
      {
        heading: "Content Ownership",
        body: (
          <p>
            You retain ownership of content you submit. By submitting content,
            you grant VoxelVein a license to host, display, and distribute it as
            part of the platform.
          </p>
        ),
      },
      {
        heading: "Termination",
        body: (
          <p>
            We may suspend or terminate access to the platform for violations of
            these Terms. You may delete your account at any time.
          </p>
        ),
      },
      {
        heading: "Disclaimer of Warranties",
        body: (
          <p>
            The platform is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, express or implied.
          </p>
        ),
      },
      {
        heading: "Limitation of Liability",
        body: (
          <p>
            To the maximum extent permitted by law, VoxelVein shall not be
            liable for indirect, incidental, or consequential damages arising
            from your use of the platform.
          </p>
        ),
      },
      {
        heading: "Governing Law",
        body: (
          <p>
            These Terms are governed by the laws of the Federal Republic of
            Germany, without regard to conflict-of-law principles.
          </p>
        ),
      },
      {
        heading: "Changes to These Terms",
        body: (
          <p>
            We may update these Terms from time to time. Continued use of the
            platform after changes constitutes acceptance of the revised Terms.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — VoxelVein" }],
  }),
  component: TermsPage,
});
