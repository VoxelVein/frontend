import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingDeletion,
  closedDeletionState,
  deletionReducer,
  initDeletionState,
  PENDING_DELETION_STORAGE_KEY,
  readPendingDeletion,
  STEP_TITLES,
  VERIFICATION_ERROR_PATTERN,
  writePendingDeletion,
} from "@/components/settings/danger/deletion-flow";
import type {
  DeletionAction,
  DeletionState,
  DeletionStep,
} from "@/components/settings/danger/deletion-flow";

/**
 * The wizard is the only place in the app where a destructive action collects
 * a password, survives a round trip through an identity provider, and has to
 * notice that the person who came back is not the person who left. The reducer
 * and the session-storage handshake are where that all lives, and neither had
 * a test.
 */

const { getDeletionContextMock } = vi.hoisted(() => ({
  getDeletionContextMock: vi.fn<() => Promise<never>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- `deletion-flow` imports the server function at module scope, which reaches `@/db` and its DATABASE_URL; only the pure state machine is under test, so the module is stubbed out entirely. A string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/account.functions", () => ({
  getAccountDeletionContext: getDeletionContextMock,
}));

const USER = "user-1";

const open = () =>
  deletionReducer(closedDeletionState, { type: "open", userId: USER });

/**
 * The shape of an action before the union narrows it.
 *
 * `DeletionAction` is a closed union, so its `default` branch is unreachable
 * from typed code — which is exactly why the branch has to exist. This is the
 * one place that admits an action the union cannot describe.
 */
interface ActionEnvelope {
  type: string;
}

const reduce = (
  state: DeletionState,
  action: DeletionAction | ActionEnvelope
): DeletionState =>
  // SAFETY: a test exercising the `default` branch, which by definition
  // receives an action outside the union. Every other call goes through
  // `deletionReducer` directly with a typed action.
  deletionReducer(state, action as DeletionAction);

describe(deletionReducer, () => {
  it("opens on the first step with the origin account recorded", () => {
    const state = open();

    expect(state.open).toBeTruthy();
    expect(state.step).toBe("consequences");
    // This is the value a later account switch is detected against, so an
    // `open` that dropped it would make the check in `delete-account-card`
    // impossible.
    expect(state.expectedUserId).toBe(USER);
  });

  it("hides the dialog on close, and the next open starts over", () => {
    const verified = deletionReducer(open(), {
      type: "verified",
      password: "hunter2",
    });
    const kept = deletionReducer(verified, {
      type: "keep",
      keep: true,
      projectId: "p1",
    });
    const closed = deletionReducer(kept, { type: "close" });

    expect(closed.open).toBeFalsy();

    // `close` deliberately only flips the flag; the reset is `open`'s job,
    // because `open` rebuilds from `closedDeletionState`. So the property that
    // matters is that a reopened wizard carries nothing over — asserted
    // against the reducer's actual contract, not an assumed one.
    const reopened = deletionReducer(closed, { type: "open", userId: USER });

    expect(reopened).toStrictEqual({
      ...closedDeletionState,
      expectedUserId: USER,
      open: true,
    });
  });

  it("carries the password to the confirm step on success", () => {
    const state = deletionReducer(open(), {
      type: "verified",
      password: "hunter2",
    });

    expect(state.step).toBe("confirm");
    expect(state.password).toBe("hunter2");
    expect(state.passwordError).toBeNull();
  });

  it("stays on the verify step and drops the password on failure", () => {
    const verified = deletionReducer(open(), {
      type: "verified",
      password: "wrong",
    });
    const failed = deletionReducer(verified, {
      type: "verification-failed",
      error: "Wrong password",
    });

    // Stepping forward on a failed check would let the confirm step send an
    // unverified request, so the step has to stay put.
    expect(failed.step).toBe("verify");
    expect(failed.password).toBeNull();
    expect(failed.passwordError).toBe("Wrong password");
  });

  it("collects and drops kept projects", () => {
    const first = deletionReducer(open(), {
      type: "keep",
      keep: true,
      projectId: "p1",
    });
    const both = deletionReducer(first, {
      type: "keep",
      keep: true,
      projectId: "p2",
    });

    expect(both.keepProjectIds).toStrictEqual(["p1", "p2"]);

    const dropped = deletionReducer(both, {
      type: "keep",
      keep: false,
      projectId: "p1",
    });
    expect(dropped.keepProjectIds).toStrictEqual(["p2"]);
  });

  it("does not duplicate a project kept twice", () => {
    const once = deletionReducer(open(), {
      type: "keep",
      keep: true,
      projectId: "p1",
    });
    const twice = deletionReducer(once, {
      type: "keep",
      keep: true,
      projectId: "p1",
    });

    // A duplicate would be sent to the server as two entries in the same list.
    expect(twice.keepProjectIds).toStrictEqual(["p1"]);
  });

  it("records the purge date and moves to the final step", () => {
    const purgeAt = new Date("2026-11-01T00:00:00.000Z").toISOString();
    const state = deletionReducer(open(), { type: "scheduled", purgeAt });

    expect(state.step).toBe("scheduled");
    expect(state.purgeAt).toBe(purgeAt);
  });

  it("reaches every step it names, from a fresh open", () => {
    const steps: DeletionStep[] = ["consequences", "verify", "confirm"];
    let state = open();

    for (const step of steps) {
      state = deletionReducer(state, { type: "go", step });
      expect(state.step).toBe(step);
    }
  });

  it("ignores an unknown action rather than losing state", () => {
    const state = deletionReducer(open(), {
      type: "verified",
      password: "hunter2",
    });

    // The `default` branch. An action added to the union later must not reset
    // a half-completed wizard.
    expect(reduce(state, { type: "nonsense" })).toStrictEqual(state);
  });
});

describe("the per-step headings", () => {
  it("names all four steps the wizard can reach", () => {
    // Compared as sets: `Object.keys` order is insertion order, which is not
    // the claim being made, and the `lib` target here predates `toSorted`.
    expect(new Set(Object.keys(STEP_TITLES))).toStrictEqual(
      new Set(["consequences", "verify", "confirm", "scheduled"])
    );
  });
});

describe("the verification failure matcher", () => {
  it("matches the messages the server actually returns", () => {
    // The two shapes: a wrong password, and a social provider saying the
    // identity is not the same one.
    expect(VERIFICATION_ERROR_PATTERN.test("Wrong password.")).toBeTruthy();
    expect(
      VERIFICATION_ERROR_PATTERN.test("That doesn't confirm it's you.")
    ).toBeTruthy();
  });

  it("does not match an unrelated failure", () => {
    expect(VERIFICATION_ERROR_PATTERN.test("Rate limit exceeded.")).toBeFalsy();
  });
});

describe(readPendingDeletion, () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips through write", () => {
    writePendingDeletion({ keepProjectIds: ["p1", "p2"], userId: USER });

    expect(readPendingDeletion()).toStrictEqual({
      keepProjectIds: ["p1", "p2"],
      userId: USER,
    });
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingDeletion()).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    window.sessionStorage.setItem(PENDING_DELETION_STORAGE_KEY, "{not json");

    // This runs during a render on the return from re-authentication, so a
    // throw here would take the settings page down.
    expect(readPendingDeletion()).toBeNull();
  });

  it("returns null when the shape is wrong", () => {
    // Parsed JSON that is not the expected object: a missing userId, then a
    // non-array of project ids.
    window.sessionStorage.setItem(
      PENDING_DELETION_STORAGE_KEY,
      JSON.stringify({ userId: USER })
    );
    expect(readPendingDeletion()).toBeNull();

    window.sessionStorage.setItem(
      PENDING_DELETION_STORAGE_KEY,
      JSON.stringify({ keepProjectIds: "p1", userId: USER })
    );
    expect(readPendingDeletion()).toBeNull();
  });

  it("does not survive a clear", () => {
    writePendingDeletion({ keepProjectIds: ["p1"], userId: USER });
    clearPendingDeletion();

    expect(readPendingDeletion()).toBeNull();
  });
});

describe("the storage helpers when sessionStorage is unavailable", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("does not let a write failure escape", () => {
    const setItem = vi
      .spyOn(window.sessionStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    // Private-mode Safari throws here. The wizard still runs; it just cannot
    // detect an account switch on return, so this must not propagate.
    expect(() =>
      writePendingDeletion({ keepProjectIds: ["p1"], userId: USER })
    ).not.toThrow();

    setItem.mockRestore();
  });

  it("does not let a clear failure escape", () => {
    const removeItem = vi
      .spyOn(window.sessionStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => clearPendingDeletion()).not.toThrow();

    removeItem.mockRestore();
  });

  it("does not let a read failure escape", () => {
    const getItem = vi
      .spyOn(window.sessionStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(readPendingDeletion()).toBeNull();

    getItem.mockRestore();
  });
});

describe(initDeletionState, () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stays closed without the re-authentication flag", () => {
    writePendingDeletion({ keepProjectIds: ["p1"], userId: USER });

    // The flag is absent, so a plain visit to the page must not reopen the
    // wizard from whatever a previous visit left behind.
    expect(initDeletionState(false)).toStrictEqual(closedDeletionState);
  });

  it("reopens on verify with the previous choices when the flag is set", () => {
    writePendingDeletion({ keepProjectIds: ["p1", "p2"], userId: USER });

    const state = initDeletionState(true);

    expect(state.open).toBeTruthy();
    // Straight back to the step the person left from, not the first one.
    expect(state.step).toBe("verify");
    expect(state.expectedUserId).toBe(USER);
    expect(state.keepProjectIds).toStrictEqual(["p1", "p2"]);
  });

  it("reopens on the first step when the flag is set but nothing was stored", () => {
    // A return with the flag and no record: the deletion cannot be resumed,
    // but the dialog still has to be open, or the person is stranded on a page
    // that looks unchanged.
    const state = initDeletionState(true);

    expect(state.open).toBeTruthy();
    expect(state.step).toBe("consequences");
    expect(state.expectedUserId).toBeNull();
    expect(state.keepProjectIds).toStrictEqual([]);
  });

  it("never restores a password across the round trip", () => {
    writePendingDeletion({ keepProjectIds: ["p1"], userId: USER });

    // The point of the storage boundary: a password must not outlive the
    // navigation that collected it.
    expect(initDeletionState(true).password).toBeNull();
  });
});
