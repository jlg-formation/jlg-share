import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { createApp } from "../src/server/app";
let store: Store;
let app: ReturnType<typeof createApp>;
let dir: string;
let clock: number;
const origin = "http://test.local";
const hash = await Bun.password.hash("a-test-password", {
  algorithm: "argon2id",
  memoryCost: 4096,
  timeCost: 1,
});
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  extra: Record<string, string> = {},
) {
  return (await app.fetch(
    new Request(origin + path, {
      method,
      headers: {
        origin,
        cookie,
        ...(data !== undefined ? { "content-type": "application/json" } : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  ))!;
}
async function client() {
  const r = await request("/api/me");
  return r.headers.get("set-cookie")!.split(";")[0];
}
async function admin() {
  const c = await client();
  expect(
    (await request("/api/login", "POST", { password: "a-test-password" }, c))
      .status,
  ).toBe(200);
  return c;
}
async function session(c: string, code = "") {
  const r = await request(
    "/api/sessions",
    "POST",
    { title: "Formation", expiresAt: clock + 3_600_000, code },
    c,
  );
  expect(r.status).toBe(201);
  return (await r.json()).id as string;
}
beforeEach(() => {
  clock = Date.now();
  dir = mkdtempSync(join(tmpdir(), "jlg-share-test-"));
  store = new Store(dir, () => clock);
  app = createApp(store, { origin, passwordHash: hash, secure: false });
});
afterEach(() => {
  app.close();
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("admin access, origin enforcement and code protection", async () => {
  const c = await client();
  expect((await request("/api/sessions", "GET", undefined, c)).status).toBe(
    401,
  );
  const a = await admin();
  const s = await session(a, "secret");
  expect(
    (await request(`/api/sessions/${s}/snapshot`, "GET", undefined, c)).status,
  ).toBe(403);
  expect(
    (
      await request(
        `/api/sessions/${s}/join`,
        "POST",
        { nickname: "Alice", code: "wrong" },
        c,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        `/api/sessions/${s}/join`,
        "POST",
        { nickname: "Alice", code: "secret" },
        c,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        `/api/sessions/${s}/messages`,
        "POST",
        { text: "hello" },
        c,
        { origin: "http://other.test" },
      )
    ).status,
  ).toBe(403);
  expect(
    (await request(`/api/sessions/${s}`, "PATCH", { closed: true }, c)).status,
  ).toBe(401);
});
test("unique nickname, identity recovery and ownership including admin moderation", async () => {
  const a = await admin();
  const s = await session(a);
  const c = await client(),
    d = await client();
  expect(
    (
      await request(
        `/api/sessions/${s}/join`,
        "POST",
        { nickname: " Alice " },
        c,
      )
    ).status,
  ).toBe(200);
  expect(
    (await request(`/api/sessions/${s}/join`, "POST", { nickname: "ALICE" }, d))
      .status,
  ).toBe(409);
  expect((await request(`/api/sessions/${s}/join`, "POST", {}, c)).status).toBe(
    200,
  );
  await request(`/api/sessions/${s}/join`, "POST", { nickname: "Bob" }, d);
  await request(
    `/api/sessions/${s}/messages`,
    "POST",
    { text: "un\nmessage <script>" },
    c,
  );
  const snapshot = await (
    await request(`/api/sessions/${s}/snapshot`, "GET", undefined, d)
  ).json();
  const m = snapshot.publications[0];
  expect(m.nickname).toBe("Alice");
  expect(m.text).toBe("un\nmessage <script>");
  expect(
    (
      await request(
        `/api/sessions/${s}/messages/${m.id}`,
        "PATCH",
        { text: "usurpation" },
        d,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        `/api/sessions/${s}/messages/${m.id}`,
        "PATCH",
        { text: "correction" },
        c,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        `/api/sessions/${s}/messages/${m.id}`,
        "PATCH",
        { text: "correction admin" },
        a,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        `/api/sessions/${s}/messages/${m.id}`,
        "DELETE",
        undefined,
        a,
      )
    ).status,
  ).toBe(200);
});
test("raw file roundtrip, download protection, quota and deletion", async () => {
  const a = await admin();
  const s = await session(a);
  const c = await client();
  const payload = new Uint8Array([0, 255, 42, 13, 10]);
  const r = (await app.fetch(
    new Request(origin + `/api/sessions/${s}/files`, {
      method: "POST",
      headers: {
        origin,
        cookie: a,
        "x-file-name": encodeURIComponent("échantillon.zip"),
        "x-file-size": "5",
      },
      body: payload,
    }),
  ))!;
  expect(r.status).toBe(201);
  const snapshot = await (
    await request(`/api/sessions/${s}/snapshot`, "GET", undefined, a)
  ).json();
  const f = snapshot.publications[0];
  expect(
    (await request(`/api/sessions/${s}/files/${f.id}`, "GET", undefined, c))
      .status,
  ).toBe(403);
  const download = await request(
    `/api/sessions/${s}/files/${f.id}`,
    "GET",
    undefined,
    a,
  );
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(payload);
  store.reserve(s, "reservation", 999_999_995);
  expect(() => store.reserve(s, "over", 1)).toThrow("1 Go");
  expect(
    (await request(`/api/sessions/${s}/files/${f.id}`, "DELETE", undefined, a))
      .status,
  ).toBe(200);
  expect(existsSync(store.path(f.id))).toBe(false);
});
test("expiry physically purges text and files, cannot be extended after deadline", async () => {
  const a = await admin();
  const s = await session(a);
  await request(
    `/api/sessions/${s}/messages`,
    "POST",
    { text: "sensitive-content-123" },
    a,
  );
  const expiresAt = clock + 1000;
  expect(
    (await request(`/api/sessions/${s}`, "PATCH", { expiresAt }, a)).status,
  ).toBe(200);
  clock = expiresAt;
  expect(
    (
      await request(
        `/api/sessions/${s}`,
        "PATCH",
        { expiresAt: clock + 10000 },
        a,
      )
    ).status,
  ).toBe(410);
  expect(
    store.db.query("SELECT COUNT(*) AS n FROM publications").get(),
  ).toEqual({ n: 0 });
  expect(
    store.db.query("SELECT COUNT(*) AS n FROM participants").get(),
  ).toEqual({ n: 0 });
  const bytes = await Bun.file(join(dir, "share.sqlite")).text();
  expect(bytes).not.toContain("sensitive-content-123");
});
test("persistence and startup cleanup", async () => {
  const a = await admin();
  const s = await session(a);
  await request(
    `/api/sessions/${s}/messages`,
    "POST",
    { text: "persistant" },
    a,
  );
  app.close();
  store.db.close();
  store = new Store(dir, () => clock);
  app = createApp(store, { origin, passwordHash: hash, secure: false });
  const data = await (
    await request(`/api/sessions/${s}/snapshot`, "GET", undefined, a)
  ).json();
  expect(data.publications[0].text).toBe("persistant");
});
