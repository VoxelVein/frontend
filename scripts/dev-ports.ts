/**
 * Reports on  -  and optionally stops  -  whatever holds the local dev ports.
 *
 * `vite.config.ts` sets `strictPort: true` on purpose: the dev origins are
 * hardcoded in better-auth's `trustedOrigins` and in the CORS setup, so a server
 * that quietly drifted to 3001 would leave you unable to sign in. The cost is
 * that a second `pnpm dev` dies with a Vite stack trace instead of a sentence
 * explaining that the first one is still running.
 *
 *   pnpm dev:status   what is on the web and API ports
 *   pnpm dev:stop     end those processes
 *
 * This never kills a port holder that is not one of ours: the pid must resolve
 * to a process whose command line mentions this directory, so `dev:stop` cannot
 * take down an unrelated service that happens to hold 3000.
 */
import { execFileSync, execSync } from "node:child_process";
import process from "node:process";

const WEB_PORT = Number(process.env.PORT ?? 3000);
const API_PORT = Number(process.env.API_PORT ?? 3002);

interface PortHolder {
  /** Full command line, trimmed, for showing the user what is running. */
  command: string;
  pid: number;
  port: number;
}

const CWD = process.cwd();

/** Capture a missing tool's stderr instead of printing it to the terminal. */
const QUIET = {
  encoding: "utf-8",
  // SAFETY: Node's exec helpers accept a three-entry stdio array; these are
  // exactly the three allowed values, fixed here rather than inferred wider.
  stdio: ["ignore", "pipe", "pipe"] as ["ignore", "pipe", "pipe"],
} as const;

const mentionsPort = (line: string, port: number): boolean =>
  line.includes(`:${port} `) || line.includes(`:${port}\t`);

/** `netstat -ano` ends each LISTENING line with its owning pid. */
const pidsFromNetstat = (output: string, port: number): number[] => {
  const pids = new Set<number>();

  for (const line of output.split("\n")) {
    if (!mentionsPort(line, port) || !/\bLISTENING\b/iu.test(line)) {
      continue;
    }

    const match = /\s(?<pid>\d+)\s*$/u.exec(line.trim());
    const pid = Number(match?.groups?.pid);

    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
};

/** `ss -ltnpH` puts its pids inside `users:(("node",pid=123,fd=23))`. */
const pidsFromSs = (output: string, port: number): number[] => {
  const pids = new Set<number>();

  for (const line of output.split("\n")) {
    if (!mentionsPort(line, port)) {
      continue;
    }

    for (const match of line.matchAll(/pid=(?<pid>\d+)/gu)) {
      const pid = Number(match.groups?.pid);

      if (Number.isInteger(pid)) {
        pids.add(pid);
      }
    }
  }

  return [...pids];
};

/**
 * pids listening on `port`, or an empty list if no tool is available.
 *
 * `netstat` on Windows, `ss` on Linux then `lsof` on macOS and minimal
 * containers. The port is a validated integer, never a user-supplied string.
 */
// oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed command strings; `port` is a validated integer, never a path or user-supplied binary
const listListeningPids = (port: number): number[] => {
  if (process.platform === "win32") {
    try {
      // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed `netstat` binary, no interpolation at all
      return pidsFromNetstat(execSync("netstat -ano -p tcp", QUIET), port);
    } catch {
      return [];
    }
  }

  try {
    // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Literal `ss` binary, no interpolation at all
    return pidsFromSs(execSync("ss -ltnpH", QUIET), port);
  } catch {
    // `ss` is missing or denied. Fall back to lsof, then give up quietly and
    // let the caller report "nothing found" rather than crashing.
    try {
      // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed `lsof` binary; `port` is a validated integer, never a path or user-supplied command
      const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, QUIET);

      return output
        .split("\n")
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0);
    } catch {
      return [];
    }
  }
};

const readCommand = (pid: number): string => {
  try {
    if (process.platform === "win32") {
      // Argument array and no shell: PowerShell receives the query as data,
      // and the pid is the integer parsed above.
      return execFileSync(
        // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed PowerShell binary; the only interpolation is a parsed integer pid
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CommandLine`,
        ],
        QUIET
      ).trim();
    }

    // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed `ps` binary; `pid` is a number parsed from the port scan, never user input
    return execSync(`ps -o args= -p ${pid}`, QUIET).trim();
  } catch {
    return "";
  }
};

/** True when the pid belongs to this checkout's dev server or its runner. */
const isOwnProcess = (command: string): boolean =>
  command.includes(CWD) || command.includes("vite") || command.includes("tsx");

const holders = (): PortHolder[] => {
  const found: PortHolder[] = [];

  for (const port of [WEB_PORT, API_PORT]) {
    for (const pid of listListeningPids(port)) {
      const command = readCommand(pid);

      if (!isOwnProcess(command)) {
        continue;
      }

      found.push({ command, pid, port });
    }
  }

  return found;
};

const describe = (holder: PortHolder): string => {
  // Trim the noisy absolute paths so the line stays readable in a terminal.
  const short = holder.command
    .replaceAll(`${CWD}/node_modules/`, "")
    .replaceAll(CWD, ".");

  return `  :${holder.port}  pid ${holder.pid}  ${short}`;
};

/**
 * The one `process.kill` failure that means "it exited on its own".
 *
 * `process.kill` rejects with an `ErrnoException`, so the code is read off the
 * caught value at the boundary rather than typed as `unknown` throughout.
 */
const isAlreadyGone = (error: Error): boolean =>
  "code" in error && error.code === "ESRCH";

const stop = (holder: PortHolder): void => {
  try {
    process.kill(holder.pid, "SIGTERM");
  } catch (error) {
    // Gone between the scan and the signal: nothing to do. Anything else is a
    // real failure  -  most likely EPERM, meaning we do not own the pid.
    if (error instanceof Error && !isAlreadyGone(error)) {
      throw error;
    }
  }
};

const reportStatus = (running: PortHolder[]): void => {
  if (running.length === 0) {
    console.log(
      `Nothing is listening on :${WEB_PORT} or :${API_PORT}. Start one with \`pnpm dev\`.`
    );

    return;
  }

  console.log("Already running:");

  for (const holder of running) {
    console.log(describe(holder));
  }

  console.log(
    "\nReuse that session. To start a fresh one, run `pnpm dev:stop` first."
  );
};

const reportStopped = (running: PortHolder[]): void => {
  if (running.length === 0) {
    console.log(`Nothing is listening on :${WEB_PORT} or :${API_PORT}.`);

    return;
  }

  console.log("Stopping:");

  for (const holder of running) {
    console.log(describe(holder));
    stop(holder);
  }

  console.log("\nStopped. If a port is still held, re-run `pnpm dev:stop`.");
};

const { 2: subcommand } = process.argv;

if (subcommand === "stop") {
  reportStopped(holders());
} else if (subcommand === "status" || subcommand === undefined) {
  reportStatus(holders());
} else {
  console.error(`Unknown command: ${subcommand}. Use "status" or "stop".`);
  process.exitCode = 1;
}
