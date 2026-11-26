import { IconShieldCheck } from "@tabler/icons-react";

import { isRole, ROLE_LABELS, can } from "@/lib/roles";

/**
 * A comment's byline.
 *
 * Staff names are deliberately heavier and tinted, and carry a shield to their
 * right, so a reader can tell an official answer from a player's without
 * reading a separate badge. The role read is current: it comes from the users
 * table when the comment is loaded, not from a snapshot taken when it was
 * posted.
 */
export const CommentAuthor = ({
  name,
  role,
}: {
  name: string;
  role: string | null;
}) => {
  const isStaff = can(role, "heartComments");
  const label = isRole(role) ? ROLE_LABELS[role] : null;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={
          isStaff
            ? "text-primary text-sm font-semibold"
            : "text-foreground text-sm font-medium"
        }
      >
        {name}
      </span>
      {isStaff && label ? (
        <>
          <span aria-hidden="true" className="text-muted-foreground text-xs">
            {label}
          </span>
          <IconShieldCheck
            aria-hidden="true"
            className="text-primary"
            size={14}
          />
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </span>
  );
};
