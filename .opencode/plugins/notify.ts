import { spawn } from "node:child_process";

import { Plugin } from "@opencode/plugin";

/** Spoken / displayed when a session finishes a turn. */
const DEFAULT_MESSAGE = "Your code is done!";

/** Collapse repeat `session.idle` events inside this window. */
const DEFAULT_COOLDOWN_MS = 5_000;

interface NotifyConfig {
  readonly cooldownMs: number;
  readonly enabled: boolean;
  readonly message: string;
}

interface NotifierCommand {
  readonly args: readonly string[];
  readonly file: string;
}

/**
 * OpenCode types plugin options as `Record<string, any>`, so read every value
 * as `unknown` and narrow it instead of trusting the annotation.
 */
const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() !== "" ? value : fallback;

const readPositiveInt = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** PowerShell single-quoted literals escape by doubling the quote. */
const escapePowerShell = (value: string): string => value.replaceAll("'", "''");

/**
 * Ordered notifier candidates for the host platform. The first one that
 * actually launches wins, so a missing binary degrades to the next entry
 * instead of failing the notification.
 */
const buildCommands = (message: string): readonly NotifierCommand[] => {
  if (process.platform === "darwin") {
    return [
      { file: "say", args: [message] },
      {
        file: "osascript",
        args: [
          "-e",
          `display notification ${JSON.stringify(message)} with title "OpenCode"`,
        ],
      },
    ];
  }

  if (process.platform === "win32") {
    return [
      {
        file: "powershell",
        args: [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          [
            "Add-Type -AssemblyName System.Speech;",
            "$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
            `$voice.Speak('${escapePowerShell(message)}');`,
            "$voice.Dispose()",
          ].join(" "),
        ],
      },
    ];
  }

  return [
    { file: "spd-say", args: [message] },
    { file: "notify-send", args: ["--app-name=OpenCode", message] },
  ];
};

/**
 * Launch a notifier detached from the plugin so the event loop is never held
 * open by it. Resolves `false` when the binary is missing (`error`) rather
 * than throwing, which is how the candidate list falls through.
 */
const runCommand = (command: NotifierCommand): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn(command.file, [...command.args], {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });

const announce = async (
  commands: readonly NotifierCommand[]
): Promise<boolean> => {
  for (const command of commands) {
    if (await runCommand(command)) return true;
  }
  return false;
};

/**
 * Announces when a session goes idle.
 *
 * OpenCode V2 replaced the V1 `event` hook with a subscription to the public
 * server event stream, so the cleanup function returned by `setup` aborts it.
 * The V1 `$` Bun shell helper is gone too, hence `node:child_process`.
 *
 * Configure through `opencode.json` (all keys optional):
 *
 * ```jsonc
 * {
 *   "plugins": [
 *     {
 *       "package": "./.opencode/plugins/notify.ts",
 *       "options": { "enabled": true, "message": "Build finished" }
 *     }
 *   ]
 * }
 * ```
 */
export default Plugin.define({
  id: "notify",
  setup(ctx) {
    const options: Readonly<Record<string, unknown>> = ctx.options;

    const config: NotifyConfig = {
      cooldownMs: readPositiveInt(options.cooldownMs, DEFAULT_COOLDOWN_MS),
      enabled: readBoolean(options.enabled, true),
      message: readString(options.message, DEFAULT_MESSAGE),
    };

    if (!config.enabled) return;

    const commands = buildCommands(config.message);
    const controller = new AbortController();

    let lastNotifiedAt = 0;
    let warnedUnavailable = false;

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          if (event.type !== "session.idle") continue;

          const now = Date.now();
          if (now - lastNotifiedAt < config.cooldownMs) continue;
          lastNotifiedAt = now;

          const delivered = await announce(commands);
          if (delivered || warnedUnavailable) continue;

          warnedUnavailable = true;
          console.warn(
            `notify: no notifier available on ${process.platform} (tried ${commands.map((command) => command.file).join(", ")}). Install one, or set "enabled": false.`
          );
        }
      } catch (error) {
        // Aborting is the normal cleanup path, not a subscription failure.
        if (controller.signal.aborted) return;
        console.error(
          `notify: event subscription failed - ${errorMessage(error)}`
        );
      }
    })();

    return () => controller.abort();
  },
});
