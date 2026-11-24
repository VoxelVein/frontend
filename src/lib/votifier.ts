/* oxlint-disable sonarjs/no-hardcoded-ip -- Literal address ranges define the SSRF denylist. */
import { constants, createHmac, publicEncrypt } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, connect, isIP } from "node:net";

import { object, string, safeParse } from "valibot";

import type { VoteProtocol } from "@/lib/server-voting";

export interface VotifierVote {
  serviceName: string;
  username: string;
  address: string;
  timestamp: number;
}

export interface VotifierResult {
  ok: boolean;
  protocol: VoteProtocol;
  detail: string;
}

const blocked = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}

const ipv6List = (
  subnets: readonly (readonly [string, number])[]
): BlockList => {
  const list = new BlockList();

  for (const [address, prefix] of subnets) {
    list.addSubnet(address, prefix, "ipv6");
  }

  return list;
};

const globalUnicastV6 = ipv6List([["2000::", 3]]);

const deniedV6 = ipv6List([
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
]);

export const isPublicVoteAddress = (address: string): boolean => {
  const family = isIP(address);

  if (family === 4) {
    return !blocked.check(address, "ipv4");
  }

  // Restrict IPv6 to global unicast, excluding documentation and transition ranges.
  return (
    family === 6 &&
    globalUnicastV6.check(address, "ipv6") &&
    !deniedV6.check(address, "ipv6")
  );
};

/** One deadline covers DNS resolution, connecting and the acknowledgement. */
const DELIVERY_TIMEOUT_MS = 5000;

/** PKCS#1 v1.5 leaves 245 plaintext bytes in a 2048-bit RSA block. */
const V1_MAX_PAYLOAD_BYTES = 245;

/**
 * The longest a v1 payload is without its service name: "VOTE", a 16-byte
 * player name, a 45-byte IPv6 address, a 13-digit timestamp and five newlines.
 */
const V1_FIXED_PAYLOAD_BYTES = 4 + 16 + 45 + 13 + 5;

/** The service name's UTF-8 budget, so any v1 vote fits in one RSA block. */
export const VOTE_SERVICE_NAME_MAX_BYTES =
  V1_MAX_PAYLOAD_BYTES - V1_FIXED_PAYLOAD_BYTES;

const lookupWithin = async (host: string, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      lookup(host, { all: true }),
      // oxlint-disable-next-line promise/avoid-new -- A timer has no promise API that can be cleared on success.
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Votifier lookup timed out.")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const encodeV1Vote = (vote: VotifierVote, publicKey = ""): Buffer => {
  const rawKey = publicKey;

  const key = rawKey.includes("BEGIN PUBLIC KEY")
    ? rawKey
    : `-----BEGIN PUBLIC KEY-----\n${rawKey}\n-----END PUBLIC KEY-----`;

  const payload = [
    "VOTE",
    vote.serviceName,
    vote.username,
    vote.address,
    String(vote.timestamp),
    "",
  ].join("\n");

  const packet = publicEncrypt(
    { key, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(payload)
  );

  if (packet.length !== 256) {
    throw new Error("Votifier requires a 2048-bit RSA public key.");
  }

  return packet;
};

export const sendVoteNotification = async (
  host: string,
  port: number | null,
  protocol: VoteProtocol,
  vote: VotifierVote,
  credentials: { token?: string | null; publicKey?: string | null }
): Promise<VotifierResult> => {
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;

  try {
    // A late lookup result is dropped: the race already rejected, so no
    // socket is ever opened for it.
    const addresses = await lookupWithin(host, DELIVERY_TIMEOUT_MS);
    const [destination] = addresses;

    if (
      !destination ||
      addresses.some(({ address }) => !isPublicVoteAddress(address))
    ) {
      throw new Error("Votifier must use a public internet address.");
    }

    // oxlint-disable-next-line promise/avoid-new -- Adapt the event-based TCP socket to one bounded request promise.
    return await new Promise<VotifierResult>((resolve) => {
      // Pin the validated address: no second DNS resolution during connect.
      const socket = connect({ host: destination.address, port: port ?? 8192 });
      let buffer = "";
      let greeted = false;

      const finish = (ok: boolean, detail: string) => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ ok, protocol, detail });
      };

      const timer = setTimeout(
        () => finish(false, "Votifier connection timed out."),
        Math.max(0, deadline - Date.now())
      );

      socket.on("error", (error) => finish(false, error.message));
      socket.on("end", () =>
        finish(false, "Votifier closed before acknowledgement.")
      );
      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf-8");

        if (buffer.length > 8192) {
          finish(false, "Invalid Votifier response.");

          return;
        }

        const newline = buffer.indexOf("\n");

        if (newline === -1) {
          return;
        }

        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);

        try {
          if (greeted) {
            const response = safeParse(
              object({ status: string() }),
              JSON.parse(line)
            );

            const ok = response.success && response.output.status === "ok";
            finish(
              ok,
              ok
                ? "Vote acknowledged by NuVotifier."
                : "NuVotifier rejected the vote; check credentials."
            );
          } else {
            greeted = true;

            if (!line.startsWith("VOTIFIER ")) {
              throw new Error("Invalid Votifier greeting.");
            }

            if (protocol === "v1") {
              const packet = encodeV1Vote(vote, credentials.publicKey ?? "");

              socket.write(packet, (error) => {
                if (error) {
                  finish(false, error.message);

                  return;
                }

                finish(
                  true,
                  "Sent; classic Votifier cannot acknowledge rewards."
                );
              });
            } else {
              const challenge = /^VOTIFIER 2 (?<challenge>\S+)$/u.exec(line)
                ?.groups?.challenge;

              if (!challenge || !credentials.token) {
                throw new Error("NuVotifier requires a v2 listener and token.");
              }

              const payload = JSON.stringify({ ...vote, challenge });

              const signature = createHmac("sha256", credentials.token)
                .update(payload)
                .digest("base64");

              const body = Buffer.from(JSON.stringify({ payload, signature }));
              const packet = Buffer.alloc(body.length + 4);
              packet.writeUInt16BE(0x73_3a, 0);
              packet.writeUInt16BE(body.length, 2);
              body.copy(packet, 4);
              socket.write(packet);
            }
          }
        } catch (error) {
          finish(
            false,
            error instanceof Error
              ? error.message
              : "Invalid Votifier response."
          );
        }
      });
    });
  } catch (error) {
    return {
      protocol,
      ok: false,
      detail:
        error instanceof Error ? error.message : "Votifier lookup failed.",
    };
  }
};
