/* oxlint-disable anti-slop/no-module-mocking, vitest/prefer-import-in-mock, promise/avoid-new, sonarjs/no-hardcoded-ip -- Real TCP listener tests redirect public DNS locally; string mocks accommodate Node overloads. */
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
  createHmac,
} from "node:crypto";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";

import { object, parse, string } from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendVoteNotification } from "@/lib/votifier";

const destination = vi.hoisted(() => ({ port: 0 }));

// Route validated public DNS to a local protocol listener, never to the internet.
vi.mock("node:dns/promises", () => ({
  lookup: () => Promise.resolve([{ address: "8.8.8.8", family: 4 }]),
}));

vi.mock("node:net", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:net")>();

  return {
    ...original,
    connect: () =>
      original.connect({ host: "127.0.0.1", port: destination.port }),
  };
});

const listeners: ReturnType<typeof createServer>[] = [];

const vote = {
  serviceName: "VoxelVein",
  username: "Steve",
  address: "1.1.1.1",
  timestamp: 123_456,
};

describe("Votifier wire protocol", () => {
  afterEach(async () => {
    await Promise.all(
      listeners.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          })
      )
    );
  });

  it("signs the challenge on the same connection and waits for a fragmented acknowledgement", async () => {
    let frame: Buffer | undefined;

    const server = createServer((socket) => {
      socket.write("VOTIFIER 2 ");
      setTimeout(() => socket.write("challenge\n"), 5);
      let buffer = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

        if (buffer.length < 4 || buffer.length < buffer.readUInt16BE(2) + 4) {
          return;
        }

        // Capture only; the awaited test body validates the frame.
        frame = buffer;
        socket.write('{"status":');
        setTimeout(() => socket.end('"ok"}\n'), 5);
      });
    });

    listeners.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    // SAFETY: Listening on a TCP port guarantees an AddressInfo result.
    const address = server.address() as AddressInfo;

    destination.port = address.port;

    const result = await sendVoteNotification(
      "public.example",
      8192,
      "v2",
      vote,
      { token: "secret" }
    );

    expect(result).toStrictEqual({
      ok: true,
      protocol: "v2",
      detail: "Vote acknowledged by NuVotifier.",
    });

    expect(frame?.readUInt16BE(0)).toBe(0x73_3a);

    const wrapper = parse(
      object({ payload: string(), signature: string() }),
      JSON.parse(frame?.subarray(4).toString() ?? "")
    );

    expect(wrapper.signature).toBe(
      createHmac("sha256", "secret").update(wrapper.payload).digest("base64")
    );
    expect(JSON.parse(wrapper.payload)).toStrictEqual({
      ...vote,
      challenge: "challenge",
    });
  });

  it("encrypts a classic Votifier vote after reading its greeting", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });

    const publicKey = keys.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    let plaintext = "";

    const server = createServer((socket) => {
      socket.write("VOTIFIER 1.9\n");
      let bytes = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        bytes = Buffer.concat([bytes, Buffer.from(chunk)]);

        if (bytes.length === 256) {
          const decoded = privateDecrypt(
            { key: keys.privateKey, padding: constants.RSA_NO_PADDING },
            bytes
          );

          plaintext = decoded.subarray(decoded.indexOf(0, 2) + 1).toString();
        }
      });
    });

    listeners.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    // SAFETY: A listening TCP server has an AddressInfo address.
    destination.port = (server.address() as AddressInfo).port;

    const result = await sendVoteNotification(
      "public.example",
      8192,
      "v1",
      vote,
      { publicKey }
    );

    expect(result.ok).toBeTruthy();
    await vi.waitFor(() =>
      expect(plaintext).toBe("VOTE\nVoxelVein\nSteve\n1.1.1.1\n123456\n")
    );
  });

  it("rejects a malformed acknowledgement", async () => {
    let receivedPacket = false;

    const server = createServer((socket) => {
      socket.write("VOTIFIER 2 challenge\n");
      socket.on("data", () => {
        receivedPacket = true;
        socket.end("garbage\n");
      });
    });

    listeners.push(server);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    // SAFETY: Listening on a TCP port guarantees an AddressInfo result.
    const address = server.address() as AddressInfo;

    destination.port = address.port;

    const result = await sendVoteNotification(
      "public.example",
      8192,
      "v2",
      vote,
      { token: "secret" }
    );

    // The vote was sent, so the failure came from parsing the acknowledgement.
    expect(receivedPacket).toBeTruthy();
    expect(result.ok).toBeFalsy();
    expect(result.detail).toMatch(/JSON/u);
  });
});
