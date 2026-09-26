import { createHmac, timingSafeEqual } from "node:crypto";

import { Elysia } from "elysia";
import { object, picklist, safeParse, string } from "valibot";

import "../env";
import { events } from "../lib/events";

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRETS = new Set([
  "dev-webhook-secret-change-me",
  "generate-with-openssl-rand-base64-32",
]);

// Signed requests older (or further in the future) than this are rejected so
// a captured webhook cannot be replayed indefinitely.
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

const loadWebhookSecret = (): string => {
  const secret = process.env.WEBHOOK_SECRET ?? "";

  if (secret.length < MIN_SECRET_LENGTH || PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error(
      `WEBHOOK_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters (e.g. \`openssl rand -base64 32\`).`
    );
  }

  return secret;
};

const WEBHOOK_SECRET = loadWebhookSecret();

const modEventSchema = object({
  event: picklist(["mod.created", "mod.updated", "mod.deleted"]),
  data: object({
    id: string(),
    name: string(),
  }),
});

const isFreshTimestamp = (timestamp: string): boolean => {
  if (!/^\d+$/u.test(timestamp)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - Number(timestamp)) <= MAX_TIMESTAMP_SKEW_SECONDS;
};

// The signature covers `${timestamp}.${rawBody}` so the timestamp cannot be
// swapped without invalidating the HMAC.
const verifySignature = (
  timestamp: string,
  payload: string,
  signature: string
): boolean => {
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest();
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expected.length === signatureBuffer.length &&
    timingSafeEqual(expected, signatureBuffer)
  );
};

export const webhooksRoute = new Elysia().post(
  "/api/webhooks/mods",
  async ({ request }) => {
    const signature = request.headers.get("x-webhook-signature") ?? "";
    const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
    const raw = await request.text();

    if (
      !isFreshTimestamp(timestamp) ||
      !verifySignature(timestamp, raw, signature)
    ) {
      return new Response("Invalid signature", { status: 401 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const parsed = safeParse(modEventSchema, body);
    if (!parsed.success) {
      return new Response("Invalid webhook payload", { status: 400 });
    }

    events.broadcast(parsed.output);
    return { ok: true };
  }
);
