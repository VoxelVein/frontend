/**
 * Runs the web app and the API side by side for `pnpm dev`.
 *
 * Every line is tagged with its source (`web` or `api`) and colored so the two
 * streams stay readable together. Nothing is collapsed or truncated: the full
 * output of each process is also appended to a timestamped file under
 * `/tmp/opencode/`, which is where to look when a crash is cut off in the
 * terminal.
 *
 * Ctrl+C stops both processes.
 */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";

// oxlint-disable-next-line sonarjs/publicly-writable-directories -- Fixed, user-approved dev log directory, not shared temp space
const LOG_DIR = "/tmp/opencode";

const COLORS = {
  api: "\u001B[35m",
  web: "\u001B[36m",
  system: "\u001B[33m",
  reset: "\u001B[0m",
} as const;

type Source = keyof Omit<typeof COLORS, "reset">;

const services: readonly { name: Source; script: string }[] = [
  { name: "web", script: "dev:web" },
  { name: "api", script: "dev:api" },
];

mkdirSync(LOG_DIR, { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
const logPath = path.join(LOG_DIR, `dev-${stamp}.log`);
const logFile = createWriteStream(logPath, { flags: "a" });

const timestamp = (): string => new Date().toTimeString().slice(0, 8);

const write = (source: Source, line: string): void => {
  const label = `${COLORS[source]}[${source}]${COLORS.reset}`;
  process.stdout.write(`${timestamp()} ${label} ${line}\n`);
  logFile.write(`${timestamp()} [${source}] ${line}\n`);
};

const children: ChildProcess[] = [];

for (const service of services) {
  // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed `pnpm` binary; the script names are hardcoded above
  const child = spawn("pnpm", ["run", service.script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
    // On Windows pnpm is a .cmd shim, which child_process cannot launch
    // directly unless it goes through the command shell.
    shell: process.platform === "win32",
  });
  children.push(child);

  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) {
      continue;
    }
    const lines = createInterface({ input: stream });
    lines.on("line", (line) => write(service.name, line));
  }

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    write("system", `${service.name} exited with ${reason}`);
  });
}

const stopAll = (): void => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

process.stdout.write(`${COLORS.system}Full log: ${logPath}${COLORS.reset}\n`);
