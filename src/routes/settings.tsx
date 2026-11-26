import {
  IconDevices,
  IconLock,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { AppSidebar, AppSidebarDrawer } from "@/components/app-sidebar";
import type { SidebarSection } from "@/components/app-sidebar";
import { PageHeader } from "@/components/page-header";
import { AvatarCard } from "@/components/settings/avatar-card";
import { ChangePasswordCard } from "@/components/settings/change-password-card";
import { SettingsDangerZone } from "@/components/settings/danger/settings-danger-zone";
import { SettingsPasskeys } from "@/components/settings/settings-passkeys";
import { SettingsProfile } from "@/components/settings/settings-profile";
import { SettingsSessions } from "@/components/settings/settings-sessions";
import { SettingsSignInMethods } from "@/components/settings/settings-sign-in-methods";
import { getSession } from "@/lib/auth.functions";
import {
  DELETE_CONFIRM,
  parseSettingsSearch,
  resolveTab,
  SETTINGS_TABS,
} from "@/lib/settings-tabs";
import type { SettingsTab } from "@/lib/settings-tabs";

/**
 * The settings navigation, grouped the same way the admin panel groups its
 * sections: by what the visitor is trying to do. The values mirror
 * `SETTINGS_TABS`, so the sidebar can never offer a section the tab list does
 * not render.
 */
const SETTINGS_SECTIONS = [
  {
    heading: "Account",
    entries: [
      {
        value: "profile",
        label: "Profile",
        icon: <IconUser size={18} aria-hidden="true" />,
      },
      {
        value: "sessions",
        label: "Sessions",
        icon: <IconDevices size={18} aria-hidden="true" />,
      },
    ],
  },
  {
    heading: "Security",
    entries: [
      {
        value: "security",
        label: "Security",
        icon: <IconLock size={18} aria-hidden="true" />,
      },
    ],
  },
  {
    heading: "Danger Zone",
    entries: [
      {
        value: "danger",
        label: "Danger Zone",
        icon: <IconTrash size={18} aria-hidden="true" />,
      },
    ],
  },
] as const satisfies readonly SidebarSection<SettingsTab>[];

const SettingsPage = () => {
  const navigate = useNavigate();
  // oxlint-disable-next-line no-use-before-define -- Route must be exported after the component for TanStack Router; SettingsPage only executes after Route is initialized
  const session = Route.useLoaderData();
  const search = useSearch({ from: "/settings" });
  const tab = resolveTab(search);

  // The deletion dialog has consumed the re-authentication return; drop the
  // flag so a reload does not reopen it.
  const handleResumeHandled = useCallback(() => {
    navigate({ to: "/settings", search: { tab: "danger" }, replace: true });
  }, [navigate]);

  const selectTab = (value: SettingsTab) => {
    // The search parameter is the source of truth, so a sidebar hop and a
    // tab click both land on the same place. `replace` keeps the page from
    // filling history with section hops.
    void navigate({
      to: "/settings",
      search: { tab: value },
      replace: true,
    });
  };

  const activeLabel =
    SETTINGS_TABS.find((entry) => entry.value === tab)?.label ?? "Settings";

  const profileSection = session?.user ? (
    <div className="grid gap-6">
      <AvatarCard image={session.user.image ?? null} name={session.user.name} />
      <SettingsProfile user={session.user} />
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Settings"
        description="Manage your account, preferences, sessions, and security."
        action={
          <AppSidebarDrawer<SettingsTab>
            activeValue={tab}
            navLabel="Settings sections"
            onSelect={selectTab}
            sections={SETTINGS_SECTIONS}
            sheetTitle="Settings"
            sheetDescription="Choose a settings area to manage."
            triggerLabel="Settings"
          />
        }
      />

      <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
        <AppSidebar<SettingsTab>
          activeValue={tab}
          collapseAriaLabel="Collapse settings navigation"
          expandAriaLabel="Expand settings navigation"
          navLabel="Settings sections"
          onSelect={selectTab}
          sections={SETTINGS_SECTIONS}
          title="Settings"
        />

        <section aria-label={activeLabel} className="min-w-0 flex-1">
          {tab === "profile" ? profileSection : null}

          {tab === "security" ? (
            <div className="grid gap-6">
              <ChangePasswordCard />
              <SettingsSignInMethods />
              <SettingsPasskeys />
            </div>
          ) : null}

          {tab === "sessions" ? (
            <SettingsSessions currentSessionToken={session?.session.token} />
          ) : null}

          {tab === "danger" ? (
            <SettingsDangerZone
              resumeDeletion={search.confirm === DELETE_CONFIRM}
              onResumeHandled={handleResumeHandled}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/settings")({
  validateSearch: parseSettingsSearch,
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/login" });
    }

    return { session };
  },
  loader: ({ context }) => context.session,
  component: SettingsPage,
});
