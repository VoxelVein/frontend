import { cors } from "@elysia/cors";
import { node } from "@elysia/node";
import { Elysia } from "elysia";

import "./env";
import { eventsRoute } from "./routes/events";
import { healthRoute } from "./routes/health";
import { postsRoute } from "./routes/posts";
import { projectsRoute } from "./routes/projects";
import { webhooksRoute } from "./routes/webhooks";

const port = Number(process.env.API_PORT ?? 3002);
const allowedOrigins = (
  process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim());

const app = new Elysia({ adapter: node() })
  .onRequest(({ set }) => {
    set.headers["content-security-policy"] =
      "default-src 'none'; frame-ancestors 'none'";
    set.headers["referrer-policy"] = "no-referrer";
    set.headers["x-content-type-options"] = "nosniff";
  })
  .use(cors({ origin: allowedOrigins }))
  .use(healthRoute)
  .use(projectsRoute)
  .use(postsRoute)
  .use(eventsRoute)
  .use(webhooksRoute);

app.listen(port, () => {
  console.log(`▸ API server listening on http://localhost:${port}`);
});
