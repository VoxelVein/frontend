import { useQuery } from "@tanstack/react-query";
import { array, object, safeParse, string } from "valibot";

import { ACCOUNT_DELETION_CONTEXT_QUERY_KEY } from "@/components/settings/sign-in-providers";
import { getAccountDeletionContext } from "@/lib/account.functions";
import type { AccountDeletionContext } from "@/lib/account.functions";

/**
 * State machine for the account deletion wizard.
 *
 * Kept apart from the step components: the steps are presentational and the
 * transitions between them are the part worth reading in one place. Social
 * re-authentication leaves the page entirely, which is why `keepProjectIds`
 * and the originating account are persisted across that round trip.
 */

export type DeletionStep = "consequences" | "verify" | "confirm" | "scheduled";

export const STEP_TITLES: Record<DeletionStep, string> = {
  confirm: "Step 3 of 3: Confirm deletion",
  consequences: "Step 1 of 3: What happens",
  scheduled: "Deletion scheduled",
  verify: "Step 2 of 3: Confirm it’s you",
};

export const PENDING_DELETION_STORAGE_KEY =
  "voxelvein:pending-account-deletion";

/** Where social re-authentication returns to, to resume the wizard. */
export const REAUTH_CALLBACK_URL = "/settings?tab=danger&confirm=delete";

export const SCHEDULED_REDIRECT_DELAY_MS = 8000;

/** Matches the errors the server returns when verification fails. */
export const VERIFICATION_ERROR_PATTERN = /password|confirm it's you/iu;

export const purgeDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

export const useDeletionContext = () =>
  useQuery({
    queryFn: () => getAccountDeletionContext(),
    queryKey: ACCOUNT_DELETION_CONTEXT_QUERY_KEY,
  });

const pendingDeletionSchema = object({
  keepProjectIds: array(string()),
  userId: string(),
});

interface PendingDeletion {
  keepProjectIds: string[];
  userId: string;
}

export const readPendingDeletion = (): PendingDeletion | null => {
  try {
    const raw = window.sessionStorage.getItem(PENDING_DELETION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const result = safeParse(pendingDeletionSchema, JSON.parse(raw));
    return result.success ? result.output : null;
  } catch {
    return null;
  }
};

export const writePendingDeletion = (pending: PendingDeletion) => {
  try {
    window.sessionStorage.setItem(
      PENDING_DELETION_STORAGE_KEY,
      JSON.stringify(pending)
    );
  } catch {
    // Storage can be unavailable (private mode); the flow still works, it
    // just cannot detect a switch to a different account on return.
  }
};

export const clearPendingDeletion = () => {
  try {
    window.sessionStorage.removeItem(PENDING_DELETION_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
};

export interface DeletionState {
  /** The account that started the deletion, to detect a switch on re-auth. */
  expectedUserId: string | null;
  keepProjectIds: string[];
  open: boolean;
  /** Collected on step 2 and sent with the final request. */
  password: string | null;
  passwordError: string | null;
  purgeAt: string | null;
  step: DeletionStep;
}

export type DeletionAction =
  | { type: "open"; userId: string | null }
  | { type: "close" }
  | { type: "go"; step: DeletionStep }
  | { type: "keep"; keep: boolean; projectId: string }
  | { type: "verified"; password: string | null }
  | { type: "verification-failed"; error: string | null }
  | { type: "scheduled"; purgeAt: string };

export const closedDeletionState: DeletionState = {
  expectedUserId: null,
  keepProjectIds: [],
  open: false,
  password: null,
  passwordError: null,
  purgeAt: null,
  step: "consequences",
};

export const deletionReducer = (
  state: DeletionState,
  action: DeletionAction
): DeletionState => {
  switch (action.type) {
    case "open": {
      return {
        ...closedDeletionState,
        expectedUserId: action.userId,
        open: true,
      };
    }
    case "close": {
      return { ...state, open: false };
    }
    case "go": {
      return { ...state, step: action.step };
    }
    case "keep": {
      const others = state.keepProjectIds.filter(
        (id) => id !== action.projectId
      );
      return {
        ...state,
        keepProjectIds: action.keep ? [...others, action.projectId] : others,
      };
    }
    case "verified": {
      return {
        ...state,
        password: action.password,
        passwordError: null,
        step: "confirm",
      };
    }
    case "verification-failed": {
      return {
        ...state,
        password: null,
        passwordError: action.error,
        step: "verify",
      };
    }
    case "scheduled": {
      return { ...state, purgeAt: action.purgeAt, step: "scheduled" };
    }
    default: {
      return state;
    }
  }
};

/**
 * Coming back from a social re-authentication (`confirm=delete`), reopen
 * the dialog where the user left it, with the choices made before leaving.
 */
export const initDeletionState = (resumeDeletion: boolean): DeletionState => {
  if (!resumeDeletion) {
    return closedDeletionState;
  }
  const pending = readPendingDeletion();
  return {
    ...closedDeletionState,
    expectedUserId: pending?.userId ?? null,
    keepProjectIds: pending?.keepProjectIds ?? [],
    open: true,
    step: pending ? "verify" : "consequences",
  };
};

export interface DeleteAccountInput {
  confirmation: string;
  keepProjectIds: string[];
  password?: string;
}

export type DeletionContext = AccountDeletionContext;
