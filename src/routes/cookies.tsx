import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal/legal-page";

const CookiesPage = () => (
  <LegalPage
    title="Cookie Policy"
    updated="September 11, 2026"
    intro={
      <>
        This Cookie Policy explains how VoxelVein uses cookies and similar
        technologies.
      </>
    }
    sections={[
      {
        heading: "What Are Cookies",
        body: (
          <p>
            Cookies are small text files stored on your device by your browser.
            They are widely used to make websites work, or work more
            efficiently, and to remember your preferences.
          </p>
        ),
      },
      {
        heading: "Cookies We Use",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {/* Not "issued by Better Auth": that is the name of the library
                  in our stack, and a cookie policy is not the place to hand a
                  visitor a dependency's brand. What matters to them is what the
                  cookie does and why it cannot be switched off. */}
              Session cookie: keeps you signed in. We set it as soon as you sign
              in and clear it when you sign out, and it cannot be turned off
              without losing access to your account.
            </li>
            <li>
              Consent preference: stored in your browser to remember whether you
              accepted or declined the cookie banner.
            </li>
            <li>
              Theme preference: stored in your browser to remember your light or
              dark theme choice.
            </li>
          </ul>
        ),
      },
      {
        heading: "Managing Cookies",
        body: (
          <p>
            You can control or delete cookies through your browser settings.
            Note that disabling the session cookie will prevent you from staying
            signed in. The consent and theme preferences are stored locally in
            your browser and can be cleared at any time.
          </p>
        ),
      },
      {
        heading: "Changes to This Policy",
        body: (
          <p>
            We may update this Cookie Policy from time to time. If a change
            affects what we store or why, we will post a notice on VoxelVein.
          </p>
        ),
      },
    ]}
  />
);

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [{ title: "Cookie Policy | VoxelVein" }],
  }),
  component: CookiesPage,
});
