# API Server

VoxelVein runs a standalone **ElysiaJS** API server (`server/`) on its own
port. It is the single entry point for mod search and real-time mod
events. The web app never talks to Meilisearch directly — the API server
proxies search and streams events to the browser over Server-Sent Events
(SSE).

## Running the server

```bash
pnpm dev:api      # watch mode (development)
pnpm start:api    # no watch (production-ish)
```

The server listens on `API_PORT` (default `3002`). Run it together with
the web app:

```bash
pnpm dev:all
```

## Environment variables

| Variable                     | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `API_URL`                    | API server base URL (server-to-server)      |
| `API_PORT`                   | API server port (default `3002`)            |
| `WEBHOOK_SECRET`             | HMAC secret for webhooks (required, 32+)    |
| `VITE_API_URL`               | API base URL used by the browser (SSE)      |
| `CORS_ORIGIN`                | Comma-separated allowed origins (optional)  |
| `MEILI_HOST`                 | Meilisearch base URL                        |
| `MEILI_SEARCH_KEY`           | Meilisearch search key (required)           |
| `SSE_MAX_CONNECTIONS`        | Max concurrent SSE streams (default `500`)  |
| `SSE_MAX_CONNECTIONS_PER_IP` | Max SSE streams per client (default `5`)    |
| `TRUST_PROXY`                | `true` to key SSE limits on proxy IP header |

The server loads `.env.local` via `server/env.ts` (imported first in every
env-consuming module) and otherwise reads `process.env`, so it works in CI
without a local env file.

The API server never uses `MEILI_MASTER_KEY` for public search.

## Endpoints

### `GET /api/health`

Liveness check. Returns `{ ok: true }` when the server is up.

### `GET /api/mods/search`

Proxies the mods search to Meilisearch. Accepts the same query parameters
the mods page sends (`q`, `category`, `gameVersion`, `loader`, `sort`) and
returns the same shape as the previous direct Meilisearch call: `hits`,
`estimatedTotalHits`, `facetDistribution`, and `query`. Sort values are
whitelisted (`downloads:desc`, `updatedAt:desc`, `name:asc`), and
`category`, `gameVersion`, and `loader` must be one of the known values
from `src/lib/mods-data.ts` (anything else returns `422`).

### `GET /api/events`

Server-Sent Events stream. The response is a long-lived `text/event-stream`
that first yields a `connected` event, then broadcasts mod events as they
arrive:

```text
event: connected
data: {"message":"connected"}

event: mod.created
data: {"id":"mod-123","name":"My Mod"}
```

Concurrent streams are capped globally (`SSE_MAX_CONNECTIONS`) and per
client (`SSE_MAX_CONNECTIONS_PER_IP`); requests over the limit get `429`.
Per-client limits only apply when `TRUST_PROXY=true`, because the Node
adapter does not expose the socket address.

The browser subscribes with `EventSource`:

```ts
const source = new EventSource(`${API_URL}/api/events`);
source.addEventListener("mod.created", handleEvent);
```

### `POST /api/webhooks/mods`

Receives mod events from external publishers. The request must include:

* `x-webhook-timestamp` — current Unix time in seconds
* `x-webhook-signature` — hex HMAC-SHA256 of `${timestamp}.${rawBody}`,
  signed with `WEBHOOK_SECRET`

```ts
import { createHmac } from "node:crypto";

const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", WEBHOOK_SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");
```

Requests whose timestamp is more than 5 minutes off are rejected, so a
captured request cannot be replayed later. The API server refuses to start
when `WEBHOOK_SECRET` is missing, shorter than 32 characters, or still a
placeholder value.

The payload is validated with a Valibot schema before broadcasting:

```json
{
  "event": "mod.created",
  "data": { "id": "mod-123", "name": "My Mod" }
}
```

Responses:

* `200` — signature valid and payload accepted, event broadcast to SSE
* `400` — invalid JSON or payload shape
* `401` — invalid signature or stale timestamp

Send a test event with:

```bash
pnpm send:webhook mod.created "My Mod"
```

## Real-time flow

```text
publisher ──POST /api/webhooks/mods──▶ API server ──SSE──▶ browser
```

1. A publisher (or `pnpm send:webhook`) posts a signed mod event.
2. The API server verifies the HMAC signature, validates the payload, and
   broadcasts it to every SSE subscriber.
3. The mods page receives the event and shows a live banner ("New mod
   added", "Mod updated", "Mod removed") with a "Refresh results" button
   that bypasses the search cache.

## Directory layout

```text
server/
├── index.ts              # Elysia entry point (Node adapter, CORS)
├── env.ts                # Loads .env.local before env reads
├── lib/
│   ├── events.ts         # Subscriber registry + AsyncQueue for SSE
│   └── meilisearch.ts    # Meilisearch client factory
└── routes/
    ├── health.ts         # GET /api/health
    ├── mods.ts           # GET /api/mods/search
    ├── events.ts         # GET /api/events (SSE)
    └── webhooks.ts       # POST /api/webhooks/mods
```

## Related

* [Meilisearch](../search/meilisearch.md)
* [Architecture Overview](overview.md)
* [Commands](../development/commands.md)
