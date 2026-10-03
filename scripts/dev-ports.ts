/**
 * Reports on — and optionally stops — whatever holds the local dev ports.
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
import { execSync } from "node:child_process";
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

/**
 * pids listening on `port`, or an empty list if neither tool is available.
 *
 * `ss` first, `lsof` as the fallback for macOS and minimal containers. Neither
 * command interpolates anything: the port is validated to an integer above, so
 * there is no shell-injection surface for the PATH warning to worry about.
 */
// oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed command strings; `port` is a validated integer, never a path or user-supplied binary
const listListeningPids = (port: number): number[] => {
  try {
    // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Literal `ss` binary, no interpolation at all
    const output = execSync("ss -ltnpH", { encoding: "utf-8" });
    const pids = new Set<number>();
    for (const line of output.split("\n")) {
      // `users:(("MainThread",pid=123,fd=23))`
      if (!line.includes(`:${port} `) && !line.includes(`:${port}\t`)) {
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
  } catch {
    // `ss` is missing or denied. Fall back to lsof, then give up quietly and
    // let the caller report "nothing found" rather than crashing.
    try {
      // oxlint-disable-next-line sonarjs/no-os-command-from-path -- Fixed `lsof` binary; `port` is a validated integer, never a path or user-supplied command
      const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
        encoding: "utf-8",
      });
      return output
        .split("\n")
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0);
    } catch {
      return [];
    }
  }
};

// oxlint-disable-next-line sonarjs/no-os-command-from-path -- `pid` is a number parsed out of `ss`/`lsof` output above, never user input
const readCommand = (pid: number): string => {
  try {
    return execSync(`ps -o args= -p ${pid}`, { encoding: "utf-8" }).trim();
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
    // real failure — most likely EPERM, meaning we do not own the pid.
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
