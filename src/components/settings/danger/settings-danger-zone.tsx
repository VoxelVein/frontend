import { IconFlame } from "@tabler/icons-react";

import { DeleteAccountCard } from "@/components/settings/danger/delete-account-card";
import { useDeletionContext } from "@/components/settings/danger/deletion-flow";

interface SettingsDangerZoneProps {
  /** Called once a `confirm=delete` return from re-authentication is consumed. */
  onResumeHandled?: () => void;
  /** The page came back from a re-authentication redirect mid-deletion. */
  resumeDeletion?: boolean;
}

/**
 * The danger zone.
 *
 * Everything here is irreversible, which is the whole point of the tab: a
 * user who opens it should not have to work out which of four controls can
 * lose them data. Change-password used to live here too, which made the
 * heading a lie; it is on the Security tab now, next to sign-in methods and
 * passkeys.
 *
 * The frame is a destructive tint rather than a card, so the boundary is
 * visible before anything on the page is read.
 */
export const SettingsDangerZone = ({
  onResumeHandled,
  resumeDeletion,
}: SettingsDangerZoneProps) => {
  const contextQuery = useDeletionContext();

  return (
    <section
      aria-labelledby="settings-danger-heading"
      className="border-destructive/40 bg-destructive/5 rounded-xl border p-5 sm:p-6"
    >
      <div className="grid gap-1.5">
        <h2
          className="text-destructive flex items-center gap-2 text-lg font-semibold"
          id="settings-danger-heading"
        >
          <IconFlame aria-hidden size={18} stroke={1.8} />
          Danger Zone
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          Actions here delete your data for good and cannot be undone. Anything
          reversible lives on the other tabs.
        </p>
      </div>

      <div className="border-destructive/30 mt-6 border-t pt-6">
        <DeleteAccountCard
          context={contextQuery.data}
          contextError={contextQuery.isError ? contextQuery.error : null}
          onResumeHandled={onResumeHandled}
          refetch={() => contextQuery.refetch()}
          resumeDeletion={resumeDeletion}
        />
      </div>
    </section>
  );
};
