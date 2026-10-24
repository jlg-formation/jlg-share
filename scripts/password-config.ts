import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function savePasswordHash(directory: string, hash: string) {
  if (!/^\$argon2(?:id|i|d)\$[^\r\n']+$/.test(hash)) {
    throw new Error("Hachage de mot de passe invalide.");
  }
  const target = join(directory, ".env");
  const example = join(directory, ".env.example");
  const existing = existsSync(target)
    ? readFileSync(target, "utf8")
    : existsSync(example)
      ? readFileSync(example, "utf8")
      : "APP_ORIGIN=http://localhost:5173\nCOOKIE_SECURE=false\n";
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:export\s+)?ADMIN_PASSWORD_HASH\s*=/.test(line));
  while (lines.at(-1) === "") lines.pop();
  const escapedHash = hash.replaceAll("$", "\\$");
  lines.push(`ADMIN_PASSWORD_HASH="${escapedHash}"`);
  writeFileSync(target, lines.join("\n") + "\n", { mode: 0o600 });
}
