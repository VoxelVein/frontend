import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// 🔧 CONFIGURATION: Set to true to enable this plugin
const ENABLED = false;

const ANNOUNCEMENT = "Your code is done!";

export default {
  id: "notify",
  /**
   * Speaks a short announcement when a session goes idle.
   *
   * OpenCode V2 replaces the V1 `event` hook with an async subscription to
   * the public event stream, so the returned cleanup function aborts it.
   * The V1 `$` Bun shell helper is gone too, so the command runs through
   * `node:child_process`.
   *
   * @param {*} ctx OpenCode plugin context
   * @returns {(() => void) | undefined} Abort callback for the subscription
   */
  setup(ctx) {
    // Plugin disabled - set ENABLED = true to activate
    if (!ENABLED) return;

    const controller = new AbortController();

    void (async () => {
      const stream = ctx.event.subscribe({ signal: controller.signal });

      for await (const event of stream) {
        if (event.type !== "session.idle") continue;

        try {
          await run("say", [ANNOUNCEMENT]);
        } catch (error) {
          console.error(
            `notify: could not run "say" - ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    })();

    return () => controller.abort();
  },
};
