import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { object, optional, parse, picklist } from "valibot";

import { SettingsDangerZone } from "@/components/settings/settings-danger-zone";
import { SettingsPasskeys } from "@/components/settings/settings-passkeys";
import { SettingsProfile } from "@/components/settings/settings-profile";
import { SettingsSessions } from "@/components/settings/settings-sessions";
import { SettingsSignInMethods } from "@/components/settings/settings-sign-in-methods";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/auth.functions";

const settingsSearchSchema = object({
  confirm: optional(picklist(["delete"])),
  // "passkeys" is the former name of the "security" tab; old links still work.
  tab: optional(
    picklist(["profile", "security", "passkeys", "sessions", "danger"])
  ),
});

const parseSettingsSearch = (search: Record<string, string | undefined>) =>
  parse(settingsSearchSchema, search);

type SettingsSearch = ReturnType<typeof parseSettingsSearch>;

const resolveTab = ({ confirm, tab }: SettingsSearch) => {
  if (tab === "passkeys") {
    return "security";
  }
  if (tab) {
    return tab;
  }
  return confirm === "delete" ? "danger" : "profile";
};

const SettingsPage = () => {
  const router = useRouter();
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

  const handleSignOut = async () => {
    let signOutError: string | null = null;

    try {
      const { error } = await authClient.signOut();
      if (error) {
        signOutError = error.message ?? "Could not sign out.";
      }
    } catch {
      signOutError = "Could not sign out.";
    }

    if (signOutError) {
      // Fall back to a hard navigation so the session state is re-read from
      // the cookie even if the client-side session store is stale.
      window.location.assign("/");
      return;
    }

    authClient.$store.notify("$sessionSignal");
    router.invalidate();
    router.navigate({ to: "/" });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
        Settings
      </h1>
      <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
        Manage your account, sessions, and security.
      </p>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({
            to: "/settings",
            search: { tab: value },
            replace: true,
          })
        }
        className="mt-8"
      >
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          {session?.user ? <SettingsProfile user={session.user} /> : null}
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-6">
            <SettingsSignInMethods />
            <SettingsPasskeys />
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <SettingsSessions currentSessionToken={session?.session.token} />
        </TabsContent>

        <TabsContent value="danger">
          <SettingsDangerZone
            onSignOut={handleSignOut}
            resumeDeletion={search.confirm === "delete"}
            onResumeHandled={handleResumeHandled}
          />
        </TabsContent>
      </Tabs>
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
