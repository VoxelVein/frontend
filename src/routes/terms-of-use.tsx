import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

const TermsOfUsePage = () => (
  <LegalPage
    title="Terms of Use"
    updated="September 11, 2026"
    intro={
      <>
        These Terms of Use set out the rules for using the VoxelVein platform as
        a user.
      </>
    }
    sections={[
      {
        heading: "Your Responsibilities",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Keep your account credentials secure.</li>
            <li>Provide accurate information when creating an account.</li>
            <li>Respect the rights of other users and content creators.</li>
            <li>Comply with all applicable laws when using the platform.</li>
          </ul>
        ),
      },
      {
        heading: "Prohibited Conduct",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>Attempting to disrupt or overload the service.</li>
            <li>
              Accessing areas of the platform you are not authorized to use.
            </li>
            <li>Uploading malicious, unlawful, or infringing content.</li>
            <li>Impersonating other users or misrepresenting your identity.</li>
          </ul>
        ),
      },
      {
        heading: "Community Content",
        body: (
          <p>
            Content on the platform is provided by the community. VoxelVein does
            not endorse and is not responsible for user-submitted content. Users
            are solely responsible for what they upload. If a user uploads
            malicious software (malware) or other unlawful content without our
            knowledge, and no one reports it, VoxelVein is not liable for it.
            The user who uploaded the content, as well as users who were aware
            of it but did not report it, bear responsibility for such content.
          </p>
        ),
      },
      {
        heading: "Account Termination",
        body: (
          <p>
            We may suspend or terminate accounts that violate these Terms of
            Use. You can delete your account at any time from the settings page.
          </p>
        ),
      },
      {
        heading: "Contact",
        body: (
          <p>
            Questions about these Terms of Use can be sent to
            mateo.sauer161013@gmail.com.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/terms-of-use")({
  head: () => ({
    meta: [{ title: "Terms of Use — VoxelVein" }],
  }),
  component: TermsOfUsePage,
});
