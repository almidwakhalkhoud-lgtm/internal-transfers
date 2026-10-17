import { createHmac, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import bcrypt from "bcryptjs";

export const chosenCodePattern = /^[A-Za-z0-9_-]{8,32}$/;
export const loginCodePattern =
  /^(?:[A-Za-z0-9_-]{8,32}|BUZZ-[A-Za-z0-9_-]{43})$/;
let pepper: Promise<string> | undefined;
async function getPepper() {
  if (!pepper)
    pepper = (async () => {
      await mkdir(".postgres", { recursive: true });
      const path =
        process.env.BUZZ_TEST === "1"
          ? ".postgres/test-access-code-pepper"
          : ".postgres/access-code-pepper";
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const secret = randomBytes(32).toString("hex");
        try {
          await writeFile(path, secret, { flag: "wx", mode: 0o600 });
          return secret;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          return readFile(path, "utf8");
        }
      }
    })();
  return pepper;
}
export function normalizeCode(code: string) {
  const value = code.trim();
  return value.length === 48 && value.startsWith("BUZZ-")
    ? value
    : value.toUpperCase();
}
export async function codeDigest(code: string) {
  const secret = await getPepper();
  if (secret.length !== 64) throw new Error("Access code key is unavailable");
  return createHmac("sha256", secret).update(normalizeCode(code)).digest("hex");
}
export async function prepareCode(code: string) {
  return {
    accessHash: await codeDigest(code),
    accessVerifier: await bcrypt.hash(normalizeCode(code), 12),
  };
}
