import { createHmac } from "node:crypto";

import { config } from "dotenv";

config({ path: ".env.local" });

const API_URL = process.env.API_URL ?? "http://localhost:3002";
const { WEBHOOK_SECRET } = process.env;

if (!WEBHOOK_SECRET) {
  console.error("WEBHOOK_SECRET is not set in .env.local.");
  process.exit(1);
}

const event = process.argv[2] ?? "mod.created";
const name = process.argv[3] ?? "Example Mod";

const payload = JSON.stringify({
  data: { id: `webhook-${Date.now()}`, name },
  event,
});

const timestamp = String(Math.floor(Date.now() / 1000));

const signature = createHmac("sha256", WEBHOOK_SECRET)
  .update(`${timestamp}.${payload}`)
  .digest("hex");

const response = await fetch(`${API_URL}/api/webhooks/mods`, {
  body: payload,
  headers: {
    "Content-Type": "application/json",
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestamp,
  },
  method: "POST",
});

console.log(`Sent ${event} webhook for "${name}" → ${response.status}`);
