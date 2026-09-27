import { describe, expect, it } from "vitest";

import { toUploadFilename } from "@/lib/upload-client";
import {
  contentTypeFor,
  hasZipMagic,
  peekStream,
  sanitizeFilename,
} from "@/lib/upload-validation";

const streamOf = (...chunks: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new Uint8Array(chunk));
      }
      controller.close();
    },
  });

const collect = async (source: AsyncIterable<Uint8Array>) => {
  const bytes: number[] = [];
  for await (const chunk of source) {
    bytes.push(...chunk);
  }
  return bytes;
};

describe(sanitizeFilename, () => {
  it("accepts simple .jar names", () => {
    expect(sanitizeFilename("sodium-fabric-0.6.12+mc1.21.jar", "mod")).toBe(
      "sodium-fabric-0.6.12+mc1.21.jar"
    );
    expect(sanitizeFilename("Mod.JAR", "plugin")).toBe("Mod.JAR");
  });

  it("accepts the archive kinds each type ships", () => {
    expect(sanitizeFilename("pack-1.0.mrpack", "modpack")).toBe(
      "pack-1.0.mrpack"
    );
    expect(sanitizeFilename("pack-1.0.zip", "modpack")).toBe("pack-1.0.zip");
    expect(sanitizeFilename("faithful-32x.zip", "resourcepack")).toBe(
      "faithful-32x.zip"
    );
    expect(sanitizeFilename("complementary.zip", "shader")).toBe(
      "complementary.zip"
    );
  });

  it("rejects extensions another type uses", () => {
    expect(sanitizeFilename("mod.zip", "mod")).toBeNull();
    expect(sanitizeFilename("pack.jar", "resourcepack")).toBeNull();
    expect(sanitizeFilename("pack.mrpack", "shader")).toBeNull();
    expect(sanitizeFilename("world.zip", "server")).toBeNull();
  });

  it("rejects other types, paths, and unsafe characters", () => {
    for (const name of [
      null,
      "",
      "notes.txt",
      "mod.jar.exe",
      "../mod.jar",
      "dir/mod.jar",
      "my mod.jar",
      ".hidden.jar",
      "mod..jar",
      `${"a".repeat(125)}.jar`,
    ]) {
      expect(sanitizeFilename(name, "mod")).toBeNull();
    }
  });
});

describe(toUploadFilename, () => {
  it("maps local names onto accepted characters", () => {
    expect(toUploadFilename("My Mod (1.0).jar")).toBe("My-Mod-1.0-.jar");
    expect(
      sanitizeFilename(toUploadFilename("../../évil name.jar"), "mod")
    ).toBe("vil-name.jar");
  });
});

describe(contentTypeFor, () => {
  it("maps each archive kind to its content type", () => {
    expect(contentTypeFor("a.jar")).toBe("application/java-archive");
    expect(contentTypeFor("a.ZIP")).toBe("application/zip");
    expect(contentTypeFor("a.mrpack")).toBe(
      "application/x-modrinth-modpack+zip"
    );
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });
});

describe(hasZipMagic, () => {
  it("detects the zip local file header", () => {
    expect(
      hasZipMagic(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))
    ).toBeTruthy();
    expect(hasZipMagic(new Uint8Array([0x50, 0x4b]))).toBeFalsy();
    expect(hasZipMagic(new TextEncoder().encode("hello"))).toBeFalsy();
  });
});

describe(peekStream, () => {
  it("reads the head across chunks and replays every byte", async () => {
    const { head, stream } = await peekStream(
      streamOf([0x50, 0x4b], [0x03], [0x04, 9, 9], [7]),
      4
    );

    expect([...head]).toStrictEqual([0x50, 0x4b, 0x03, 0x04, 9, 9]);
    await expect(collect(stream)).resolves.toStrictEqual([
      0x50, 0x4b, 0x03, 0x04, 9, 9, 7,
    ]);
  });

  it("handles streams shorter than the requested head", async () => {
    const { head, stream } = await peekStream(streamOf([1]), 4);

    expect([...head]).toStrictEqual([1]);
    await expect(collect(stream)).resolves.toStrictEqual([1]);
  });
});
