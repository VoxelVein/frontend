import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS_DIR = path.resolve(".output/public/assets");
const MAIN_CHUNK_PATTERN = /^index-.*\.js$/u;
// Raised from 700_000 to 720_000 for project icons and gallery images, which
// added ~18 kB. The gzip limit is unchanged and has plenty of headroom, so
// this is a raw-bytes threshold rather than a real payload regression.
const RAW_LIMIT_BYTES = 720_000;
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
