import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { savePasswordHash } from "../scripts/password-config";

test("password setup saves a quoted hash and preserves other settings", async () => {
  const directory = mkdtempSync(join(tmpdir(), "jlg-password-"));
  try {
    const hash = await Bun.password.hash("setup-test-password");
    writeFileSync(
      join(directory, ".env.example"),
      "APP_ORIGIN=http://localhost:5173\nADMIN_PASSWORD_HASH=\n",
    );
    savePasswordHash(directory, hash);
    const initial = readFileSync(join(directory, ".env"), "utf8");
    expect(initial).toContain(
      `ADMIN_PASSWORD_HASH="${hash.replaceAll("$", "\\$")}"`,
    );
    expect(initial).toContain("APP_ORIGIN=http://localhost:5173");
    expect(initial).not.toContain("setup-test-password");
    writeFileSync(join(directory, ".env"), initial + "PORT=3456\n");
    const replacement = await Bun.password.hash("replacement-password");
    savePasswordHash(directory, replacement);
    const result = readFileSync(join(directory, ".env"), "utf8");
    expect(result).toContain("PORT=3456");
    expect(result).not.toContain(hash);
    expect(result.match(/^ADMIN_PASSWORD_HASH=/gm)).toHaveLength(1);
    const childEnv = { ...process.env };
    delete childEnv.ADMIN_PASSWORD_HASH;
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        'process.stdout.write(process.env.ADMIN_PASSWORD_HASH ?? "")',
      ],
      { cwd: directory, env: childEnv, stdout: "pipe", stderr: "pipe" },
    );
    expect(await new Response(child.stdout).text()).toBe(replacement);
    expect(await child.exited).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
