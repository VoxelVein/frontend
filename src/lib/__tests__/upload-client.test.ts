import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadVersionFile } from "@/lib/upload-client";

type LoadListener = () => void;

interface FakeResponse {
  responseText: string;
  status: number;
}

/** The response the next `send()` should answer with. */
let nextResponse: FakeResponse = { responseText: "", status: 201 };

/**
 * XMLHttpRequest is not scriptable in jsdom, and the upload client needs the
 * `load` event rather than fetch's promise. This stub lets each test choose
 * the status and body the route would have answered with.
 */
class FakeXmlHttpRequest {
  private readonly listeners = new Map<string, LoadListener>();

  responseText = "";
  status = 0;
  upload = { addEventListener: vi.fn<() => void>() };

  open = vi.fn<() => void>();
  setRequestHeader = vi.fn<() => void>();

  addEventListener = (name: string, listener: LoadListener) => {
    this.listeners.set(name, listener);
  };

  send = () => {
    this.status = nextResponse.status;
    this.responseText = nextResponse.responseText;
    this.listeners.get("load")?.();
  };
}

const file = () =>
  new File(["archive"], "sodium-0.6.0.jar", {
    type: "application/java-archive",
  });

const upload = () =>
  uploadVersionFile({
    file: file(),
    projectId: "0b8f7c1e-4b1a-4c7e-9a55-1c2d3e4f5a6b",
    versionId: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  });

describe("version file uploads", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a 200 response that still carries the uploaded file", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    nextResponse = {
      responseText: JSON.stringify({
        filename: "sodium-0.6.0.jar",
        id: "file-id",
        primary: true,
        sha1: "a",
        sha512: "b",
        size: 7,
      }),
      status: 200,
    };

    // A proxy can rewrite 201 to 200 while leaving the body intact. Reporting
    // "The upload failed (200)." for that was the bug.
    await expect(upload()).resolves.toMatchObject({
      filename: "sodium-0.6.0.jar",
    });
  });

  it("uses the server's message when an error body is present", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    nextResponse = {
      responseText: JSON.stringify({
        error: "Files can be at most 1000 bytes.",
      }),
      status: 413,
    };

    await expect(upload()).rejects.toThrow("Files can be at most 1000 bytes.");
  });

  it("does not put a bare status in the fallback message", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXmlHttpRequest);
    nextResponse = {
      responseText: "<html>gateway error</html>",
      status: 502,
    };

    await expect(upload()).rejects.toThrow(
      "The upload failed. Check your connection."
    );
  });
});
