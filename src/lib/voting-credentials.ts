import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const encryptionKey = (): Buffer => {
  const key = Buffer.from(process.env.VOTING_ENCRYPTION_KEY ?? "", "base64");

  if (key.length !== 32) {
    throw new Error(
      "Configure VOTING_ENCRYPTION_KEY with a base64 encoded 32-byte key."
    );
  }

  return key;
};

export const encryptVoteToken = (value: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf-8"),
    cipher.final(),
  ]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
};

export const decryptVoteToken = (value: string): string => {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64"));

  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted voting credential.");
  }

  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);

  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString(
    "utf-8"
  );
};
