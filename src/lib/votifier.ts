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

export const isPublicVoteAddress = (address: string): boolean => {
  const family = isIP(address);

  if (family === 4) {
    return !blocked.check(address, "ipv4");
  }

  // Restrict IPv6 to global unicast, excluding documentation and transition ranges.
  if (family !== 6 || !/^[23]/u.test(address)) {
    return false;
  }

  const denied = new BlockList();
  denied.addSubnet("2001::", 23, "ipv6");
  denied.addSubnet("2001:db8::", 32, "ipv6");
  denied.addSubnet("2002::", 16, "ipv6");
  denied.addSubnet("3fff::", 20, "ipv6");

  return !denied.check(address, "ipv6");
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
  try {
    const addresses = await lookup(host, { all: true });
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
        5000
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

              socket.write(packet, () =>
                finish(
                  true,
                  "Sent; classic Votifier cannot acknowledge rewards."
                )
              );
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
