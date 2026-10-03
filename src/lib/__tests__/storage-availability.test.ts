import { describe, expect, it } from "vitest";

import {
  StorageRequestError,
  storageFailureMessage,
  storageUnavailableNote,
  STORAGE_UNAVAILABLE_REASON,
  STORAGE_UNREACHABLE_TOAST,
} from "@/lib/storage-availability";

describe(storageFailureMessage, () => {
  it("asks the reader to report an endpoint that did not answer", () => {
    const error = new StorageRequestError(
      "unreachable",
      "Could not reach the file server."
    );

    const message = storageFailureMessage(error, "The upload failed.");

    // The three things worth saying: what happened, that it is not their doing,
    // and that reporting it helps.
    expect(message).toBe(STORAGE_UNREACHABLE_TOAST);
    expect(message).toMatch(/could not reach/iu);
    expect(message).toMatch(/report/iu);
  });

  it("explains a missing file server rather than reporting an outage", () => {
    // The two failures need different words: one is "nobody set this up" and
    // the other is "it is set up and broken". Telling a reader to report a
    // misconfiguration sends them chasing a bug that is only a missing variable.
    const error = new StorageRequestError("not-configured", "No storage.");

    expect(storageFailureMessage(error, "fallback")).toBe(
      STORAGE_UNAVAILABLE_REASON
    );
  });

  it("prefers what the server said for a failure it classified but we do not", () => {
    // Inventing a second sentence for a code we have no wording for would be
    // worse than repeating the server's, which is closer to the truth.
    const error = new StorageRequestError(
      "something-new",
      "The bucket is busy."
    );

    expect(storageFailureMessage(error, "fallback")).toBe(
      "The bucket is busy."
    );
  });

  it("passes an ordinary error through, since the server described it", () => {
    const error = new Error("That file is too large.");

    expect(storageFailureMessage(error, "fallback")).toBe(
      "That file is too large."
    );
  });

  it("falls back when there is nothing usable to say", () => {
    expect(storageFailureMessage("not an error", "The upload failed.")).toBe(
      "The upload failed."
    );
    expect(storageFailureMessage(null, "The upload failed.")).toBe(
      "The upload failed."
    );
    expect(storageFailureMessage(undefined, "The upload failed.")).toBe(
      "The upload failed."
    );
  });
});

describe(storageUnavailableNote, () => {
  it("names the action that cannot be done", () => {
    expect(storageUnavailableNote("Creating a version")).toMatch(
      /creating a version need the file server/iu
    );
  });

  it("defaults to uploads when no noun is given", () => {
    expect(storageUnavailableNote()).toMatch(/^uploads need/iu);
  });

  it("says the server is missing, rather than blaming the reader", () => {
    // It is read beside a control that has just gone dead, often by whoever is
    // about to go and tell the admins, so it has to be accurate about cause.
    expect(storageUnavailableNote()).toMatch(/does not have configured/iu);
  });
});

describe("the two messages", () => {
  it("both say the reader's own setup is not at fault", () => {
    expect(STORAGE_UNAVAILABLE_REASON).toMatch(/nothing is wrong with your/iu);
    expect(STORAGE_UNREACHABLE_TOAST).toMatch(/rather than yours/iu);
  });

  it("are not the same sentence", () => {
    // One is "nobody configured this"; the other is "it is configured and
    // broken". Collapsing them would tell a reader to report a missing variable.
    expect(STORAGE_UNAVAILABLE_REASON).not.toBe(STORAGE_UNREACHABLE_TOAST);
  });

  it("keeps the tooltip short enough to read at a glance", () => {
    expect(STORAGE_UNAVAILABLE_REASON.length).toBeLessThan(220);
    expect(STORAGE_UNREACHABLE_TOAST.length).toBeLessThan(220);
  });
});

describe(StorageRequestError, () => {
  it("carries the code the server classified it with", () => {
    const error = new StorageRequestError("unreachable", "nope");

    // The reason this exists: the code has to survive the round trip, because
    // recognising the failure by its wording silently stops working the moment
    // somebody rewords it.
    expect(error.code).toBe("unreachable");
    expect(error).toBeInstanceOf(Error);
  });
});
