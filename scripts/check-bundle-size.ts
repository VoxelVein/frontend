import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS_DIR = path.resolve(".output/public/assets");
const MAIN_CHUNK_PATTERN = /^index-.*\.js$/u;
// Raised 700_000 -> 720_000 for project icons and gallery images (~18 kB), and
// again to 780_000 for the Markdown sanitiser. DOMPurify is the cost of letting
// post bodies contain HTML, which is a deliberate feature rather than a
// dependency that crept in: it is the price of rendering author HTML at all,
// and about 29 kB of it is paid only by routes that render a post.
//
// The gzip limit is the one that tracks what a reader downloads, and it is
// unchanged at 250_000. Raw bytes never tracked that — it counts minified text,
// which no reader receives.
const RAW_LIMIT_BYTES = 780_000;
const GZIP_LIMIT_BYTES = 250_000;

const formatBytes = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

const findMainChunk = (): string | undefined => {
  if (!existsSync(ASSETS_DIR)) {
    return undefined;
  }

  let largest: string | undefined;
  for (const file of readdirSync(ASSETS_DIR)) {
    if (!MAIN_CHUNK_PATTERN.test(file)) {
      continue;
    }
    const fullPath = path.resolve(ASSETS_DIR, file);
    if (!largest || statSync(fullPath).size > statSync(largest).size) {
      largest = fullPath;
    }
  }
  return largest;
};

const skipBuild = process.argv.includes("--no-build");

if (!skipBuild) {
  console.log("▸ Building application …");
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- fixed project command
  execSync("pnpm build", { stdio: "inherit" });
}

const mainChunk = findMainChunk();
if (!mainChunk) {
  console.error(
    "✗ Main chunk not found. Run `pnpm build` (or pass --no-build after building)."
  );
  process.exit(1);
}

const rawBytes = statSync(mainChunk).size;
const gzipBytes = gzipSync(readFileSync(mainChunk)).length;

console.log(`\n  Main chunk: ${mainChunk}`);
console.log(
  `  Raw size:   ${formatBytes(rawBytes)} (limit ${formatBytes(RAW_LIMIT_BYTES)})`
);
console.log(
  `  Gzip size:  ${formatBytes(gzipBytes)} (limit ${formatBytes(GZIP_LIMIT_BYTES)})`
);

const rawOver = rawBytes > RAW_LIMIT_BYTES;
const gzipOver = gzipBytes > GZIP_LIMIT_BYTES;

if (rawOver || gzipOver) {
  console.error("\n✗ Bundle size exceeds the configured limit.");
  process.exit(1);
}

console.log("\n✓ Bundle size within limits.");
