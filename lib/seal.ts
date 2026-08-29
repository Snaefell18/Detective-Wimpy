import crypto from "node:crypto";

/**
 * Der komplette Fall (inklusive Täter) darf niemals im Browser landen -
 * sonst könnte man ihn in den Dev-Tools einfach nachlesen.
 *
 * Darum wird er serverseitig verschlüsselt ("versiegelt"), der Client trägt
 * nur das undurchsichtige Siegel mit sich herum und schickt es bei jeder
 * Anfrage zurück. So bleibt alles zustandslos - ideal für Vercel.
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret =
    process.env.CASE_SECRET ??
    process.env.ANTHROPIC_API_KEY ??
    "detective-wimpy-dev-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

export function seal(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, payload]).toString("base64url");
}

export function unseal<T>(siegel: string): T {
  const raw = Buffer.from(siegel, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const payload = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(payload), decipher.final()]).toString(
    "utf8",
  );
  return JSON.parse(json) as T;
}
