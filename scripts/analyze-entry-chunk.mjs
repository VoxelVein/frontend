import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Attributes minified bytes back to source modules using the build's sourcemap.
 *
 * Fingerprinting the output for library names is guesswork: minified names do
 * not survive, and a chunk can contain a library without its name appearing.
 * The sourcemap is the only honest way to answer "what is in the entry chunk".
 */

const ASSETS = path.resolve(".output/public/assets");
const mapName = readdirSync(ASSETS).find((f) => /^index-.*\.js\.map$/u.test(f));
if (!mapName) {
  throw new Error("no sourcemap for the entry chunk");
}

const codeName = mapName.replace(/\.map$/u, "");
const map = JSON.parse(readFileSync(path.join(ASSETS, mapName), "utf-8"));
const code = readFileSync(path.join(ASSETS, codeName), "utf-8");

/** Absolute byte offset of the start of each generated line. */
const lineStarts = [0];
for (let i = 0; i < code.length; i += 1) {
  if (code[i] === "\n") {
    lineStarts.push(i + 1);
  }
}

const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Minimal base64 VLQ decoder, per the sourcemap spec.
 *
 * Bitwise throughout, and unavoidably so: VLQ packs a variable-length integer
 * into the low bits of each base64 character with the continuation flag in bit 5.
 * There is no arithmetic formulation of this that reads any better.
 */
// oxlint-disable no-bitwise -- VLQ is a bit-packed format; see above.
const decodeVlq = (segment) => {
  const values = [];
  let shift = 0;
  let accumulator = 0;
  for (const char of segment) {
    const digit = CHARS.indexOf(char);
    if (digit === -1) {
      throw new Error(`bad VLQ char ${char}`);
    }
    const hasContinuation = digit & 32;
    accumulator += (digit & 31) << shift;
    if (hasContinuation) {
      shift += 5;
    } else {
      const negative = accumulator & 1;
      const value = accumulator >> 1;
      accumulator = 0;
      shift = 0;
      values.push(negative ? -value : value);
    }
  }
  return values;
};

/**
 * Every mapped segment as an absolute generated offset plus its source.
 *
 * Only the first segment for a given source line matters: a module's bytes run
 * from where its first mapping starts to where the next module's begins.
 */
const segments = [];
{
  let sourceIndex = 0;
  const lines = map.mappings.split(";");
  for (
    let generatedLine = 0;
    generatedLine < lines.length;
    generatedLine += 1
  ) {
    let generatedColumn = 0;
    for (const segment of lines[generatedLine].split(",")) {
      if (segment !== "") {
        const fields = decodeVlq(segment);
        generatedColumn += fields[0];
        if (fields.length >= 4) {
          sourceIndex += fields[1];
          segments.push({
            offset: (lineStarts[generatedLine] ?? 0) + generatedColumn,
            source: map.sources[sourceIndex],
          });
        }
      }
    }
  }
}

segments.toSorted((a, b) => a.offset - b.offset);

const perSource = new Map();
for (const [index, { offset, source }] of segments.entries()) {
  const next = segments[index + 1];
  const size = (next?.offset ?? code.length) - offset;

  if (source && size > 0) {
    perSource.set(source, (perSource.get(source) ?? 0) + size);
  }
}

const packageOf = (source) => {
  // pnpm resolves to `node_modules/.pnpm/<pkg>@<version>/node_modules/<name>`,
  // so the trailing segment is the package the source belongs to.
  const scoped =
    /node_modules\/\.pnpm\/[^/]+\/node_modules\/(?<name>(?:@[^/]+\/)?[^/]+)/u.exec(
      source
    );
  if (scoped?.groups) {
    return scoped.groups.name;
  }
  const plain = /node_modules\/(?<name>(?:@[^/]+\/)?[^/]+)/u.exec(source);
  if (plain?.groups) {
    return plain.groups.name;
  }
  return source.includes("src/") || source.startsWith("..")
    ? "app source"
    : "other";
};

const byPackage = new Map();
for (const [source, size] of perSource) {
  const pkg = packageOf(source);
  byPackage.set(pkg, (byPackage.get(pkg) ?? 0) + size);
}

const total = [...perSource].reduce((sum, [, size]) => sum + size, 0);
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

console.log(`entry chunk ${kb(code.length)}, mapped ${kb(total)}\n`);
console.log("bytes by package (top 20):");
for (const [pkg, size] of [...byPackage]
  .toSorted((a, b) => b[1] - a[1])
  .slice(0, 20)) {
  console.log(
    `  ${kb(size).padStart(9)}  ${String(Math.round((size / total) * 100)).padStart(3)}%  ${pkg}`
  );
}
console.log("\nbytes by source file (top 15):");
for (const [source, size] of [...perSource]
  .toSorted((a, b) => b[1] - a[1])
  .slice(0, 15)) {
  console.log(
    `  ${kb(size).padStart(9)}  ${source.replace(/^.*node_modules\//u, "")}`
  );
}
