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
test("avatars: validation, ownership, atomic updates and persistence", async () => {
  const a = await admin();
  const s = await session(a);
  const base = `/api/sessions/${s}`;
  const alice = await client();
  const bob = await client();
  const outsider = await client();
  expect(
    (
      await request(
        base + "/join",
        "POST",
        { nickname: "Alice", avatarId: 8 },
        alice,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        base + "/join",
        "POST",
        { nickname: "Bob", avatarId: 20 },
        bob,
      )
    ).status,
  ).toBe(200);
  await request(base + "/messages", "POST", { text: "Bonjour" }, alice);
  const initial = await (
    await request(base + "/snapshot", "GET", undefined, alice)
  ).json();
  const aliceId = initial.me.id;
  const expiry = initial.session.expiresAt;
  expect(initial.me.avatarId).toBe(8);
  expect(initial.publications[0].avatarId).toBe(8);
  expect(
    (await request(base + "/me", "PATCH", { avatarId: 3 }, outsider)).status,
  ).toBe(403);
  expect(
    (
      await request(base + "/me", "PATCH", { avatarId: 3 }, alice, {
        origin: "http://other.test",
      })
    ).status,
  ).toBe(403);
  for (const avatarId of [
    0,
    21,
    -1,
    1.5,
    "3",
    null,
    {},
    "<svg onload=alert(1)>",
  ]) {
    expect(
      (
        await request(
          base + "/me",
          "PATCH",
          { nickname: "Autre nom", avatarId },
          alice,
        )
      ).status,
    ).toBe(400);
  }
  expect(
    (await (await request(base + "/snapshot", "GET", undefined, alice)).json())
      .me.nickname,
  ).toBe("Alice");
  for (const avatarId of [21, 22, 23, 24, 25, 26]) {
    expect(
      (await request(base + "/me", "PATCH", { avatarId, admin: true }, alice))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          base + "/join",
          "POST",
          { nickname: "Intrus", avatarId },
          await client(),
        )
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await request(
        base + "/me",
        "PATCH",
        { nickname: "Bob", avatarId: 10 },
        alice,
      )
    ).status,
  ).toBe(409);
  expect(
    (await (await request(base + "/snapshot", "GET", undefined, alice)).json())
      .me.avatarId,
  ).toBe(8);
  const stranger = await client();
  expect(
    (
      await request(
        base + "/join",
        "POST",
        { nickname: "Chloé", avatarId: 21 },
        stranger,
      )
    ).status,
  ).toBe(400);
  expect(
    (await request(base + "/snapshot", "GET", undefined, stranger)).status,
  ).toBe(403);
  // A submitted participantId never permits editing somebody else's avatar.
  expect(
    (
      await request(
        base + "/me",
        "PATCH",
        { avatarId: 15, participantId: aliceId },
        bob,
      )
    ).status,
  ).toBe(200);
  expect(
    (await (await request(base + "/snapshot", "GET", undefined, alice)).json())
      .me.avatarId,
  ).toBe(8);
  for (let avatarId = 1; avatarId <= 20; avatarId++)
    expect(
      (await request(base + "/me", "PATCH", { avatarId }, alice)).status,
    ).toBe(200);
  // Returning through /join preserves the saved character, even if a new default is sent.
  expect(
    (
      await (
        await request(base + "/join", "POST", { avatarId: 1 }, alice)
      ).json()
    ).avatarId,
  ).toBe(20);
  const state = await (
    await request(base + "/snapshot", "GET", undefined, a)
  ).json();
  expect(state.publications[0].avatarId).toBe(20);
  expect(
    state.participants.find((p: { id: string }) => p.id === aliceId).avatarId,
  ).toBe(20);
  expect(state.session.expiresAt).toBe(expiry);
  expect(
    (
      await request(
        base,
        "PATCH",
        { avatarId: 24, slug: "adresse invalide" },
        a,
      )
    ).status,
  ).toBe(400);
  expect(
    (await (await request(base + "/snapshot", "GET", undefined, a)).json()).me
      .avatarId,
  ).toBe(21);
  expect((await request(base, "PATCH", { avatarId: 11 }, a)).status).toBe(400);
  for (const avatarId of [21, 22, 23, 24, 25, 26])
    expect((await request(base, "PATCH", { avatarId }, a)).status).toBe(200);
  app.close();
  store.db.close();
  store = new Store(dir, () => clock);
  app = createApp(store, { origin, passwordHash: hash, secure: false });
  const restored = await (
    await request(base + "/snapshot", "GET", undefined, alice)
  ).json();
  expect(restored.me.avatarId).toBe(20);
  expect(restored.publications[0].avatarId).toBe(20);
  expect(restored.session.expiresAt).toBe(expiry);
  clock = expiry + 1;
  expect(
    (await request(base + "/me", "PATCH", { avatarId: 4 }, alice)).status,
  ).toBe(410);
  expect(
    store.db
      .query("SELECT COUNT(*) AS n FROM participants WHERE session_id=?")
      .get(s),
  ).toEqual({ n: 0 });
});

test("session creation saves the trainer avatar atomically and rejects student avatars", async () => {
  const a = await admin();
  const count = () =>
    store.db.query("SELECT COUNT(*) AS n FROM sessions").get();
  for (const avatarId of [1, 20, 27, null, "21"]) {
    const before = count();
    expect(
      (
        await request(
          "/api/sessions",
          "POST",
          { title: "Avatar refusé", expiresAt: clock + 3600000, avatarId },
          a,
        )
      ).status,
    ).toBe(400);
    expect(count()).toEqual(before);
    expect(
      store.db.query("SELECT COUNT(*) AS n FROM participants").get(),
    ).toEqual({ n: 0 });
    expect(
      store.db.query("SELECT COUNT(*) AS n FROM session_addresses").get(),
    ).toEqual({ n: 0 });
  }
  const created = await request(
    "/api/sessions",
    "POST",
    { title: "Avatar choisi", expiresAt: clock + 3600000, avatarId: 26 },
    a,
  );
  expect(created.status).toBe(201);
  const s = await created.json();
  const snapshot = await (
    await request(`/api/sessions/${s.id}/snapshot`, "GET", undefined, a)
  ).json();
  expect(snapshot.me.avatarId).toBe(26);
  expect(snapshot.me.admin).toBe(true);
  expect(
    (
      await (
        await request(
          `/api/sessions/${await session(a)}/snapshot`,
          "GET",
          undefined,
          a,
        )
      ).json()
    ).me.avatarId,
  ).toBe(21);
});

test("existing participants receive an avatar when the database is upgraded", async () => {
  const a = await admin();
  const s = await session(a);
  app.close();
  store.db.exec("ALTER TABLE participants DROP COLUMN avatar_id");
  store.db.close();
  store = new Store(dir, () => clock);
  app = createApp(store, { origin, passwordHash: hash, secure: false });
  const state = await (
    await request(`/api/sessions/${s}/snapshot`, "GET", undefined, a)
  ).json();
  expect(state.me.nickname).toBe("Formateur");
  expect(state.me.avatarId).toBe(21);
});

test("upgrade the original 20-avatar constraint without losing session resources", async () => {
  const a = await admin();
  const s = await session(a, "secret");
  const base = `/api/sessions/${s}`;
  const guest = await client();
  await request(
    base + "/join",
    "POST",
    { nickname: "Alice", code: "secret", avatarId: 18 },
    guest,
  );
  await request(
    base + "/messages",
    "POST",
    { text: "Message conservé" },
    guest,
  );
  const payload = new Uint8Array([0, 255, 42, 13, 10]);
  const upload = (await app.fetch(
    new Request(origin + base + "/files", {
      method: "POST",
      headers: {
        origin,
        cookie: a,
        "x-file-name": "exercice.zip",
        "x-file-size": "5",
      },
      body: payload,
    }),
  ))!;
  expect(upload.status).toBe(201);
  const before = await (
    await request(base + "/snapshot", "GET", undefined, a)
  ).json();
  const file = before.publications.find(
    (p: { kind: string }) => p.kind === "file",
  );
  app.close();
  // Reproduce the schema installed by the first avatar implementation.
  store.db.transaction(() => {
    store.db.exec(`
      ALTER TABLE participants ADD COLUMN old_avatar INTEGER NOT NULL DEFAULT 1 CHECK(old_avatar BETWEEN 1 AND 20);
      UPDATE participants SET old_avatar=CASE WHEN admin=1 THEN 1 ELSE avatar_id END;
      ALTER TABLE participants DROP COLUMN avatar_id;
      ALTER TABLE participants RENAME COLUMN old_avatar TO avatar_id;
    `);
  })();
  expect(() =>
    store.db.query("UPDATE participants SET avatar_id=21 WHERE admin=1").run(),
  ).toThrow("CHECK constraint failed");
  store.db.close();
  for (let restart = 0; restart < 2; restart++) {
    store = new Store(dir, () => clock);
    app = createApp(store, { origin, passwordHash: hash, secure: false });
    const after = await (
      await request(base + "/snapshot", "GET", undefined, a)
    ).json();
    expect(after.session).toEqual(before.session);
    expect(after.me).toEqual(before.me);
    expect(after.participants).toEqual(before.participants);
    expect(after.publications).toEqual(before.publications);
    expect(store.db.query("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(store.db.query("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
    expect(
      new Uint8Array(
        await (
          await request(base + "/files/" + file.id, "GET", undefined, guest)
        ).arrayBuffer(),
      ),
    ).toEqual(payload);
    const updated = await request(base, "PATCH", { avatarId: 26 }, a);
    expect(updated.status).toBe(200);
    expect(
      (await request(base + "/me", "PATCH", { avatarId: 26 }, guest)).status,
    ).toBe(400);
    // Reset the trainer choice to compare the complete state again at restart.
    await request(base, "PATCH", { avatarId: 21 }, a);
    if (restart === 0) {
      app.close();
      store.db.close();
    }
  }
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
    (
      await request(
        `/api/sessions/${s}`,
        "PATCH",
        { expiresAt: clock + 7200000 },
        c,
      )
    ).status,
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

test("participants can rename only themselves without losing publications or permissions", async () => {
  const a = await admin();
  const s = await session(a);
  const base = "/api/sessions/" + s;
  const alice = await client(),
    bob = await client(),
    outsider = await client();
  await request(base + "/join", "POST", { nickname: "Alice" }, alice);
  await request(base + "/join", "POST", { nickname: "Bob" }, bob);
  const original = await (
    await request(base + "/snapshot", "GET", undefined, alice)
  ).json();
  await request(base + "/messages", "POST", { text: "Bonjour" }, alice);
  expect(
    (await request(base + "/me", "PATCH", { nickname: "Intrus" }, outsider))
      .status,
  ).toBe(403);
  for (const name of ["", " ", "x".repeat(41), "Alice (admin)"]) {
    expect(
      (await request(base + "/me", "PATCH", { nickname: name }, alice)).status,
    ).toBe(400);
  }
  expect(
    (await request(base + "/me", "PATCH", { nickname: "  bOb  " }, alice))
      .status,
  ).toBe(409);
  expect(
    (await request(base + "/me", "PATCH", { nickname: "ＡＬＩＣＥ" }, bob))
      .status,
  ).toBe(409);
  expect(
    (await request(base + "/me", "PATCH", { nickname: "  ALICE  " }, alice))
      .status,
  ).toBe(200);
  expect(
    (
      await request(
        base + "/me",
        "PATCH",
        {
          nickname: "Alicia",
          id: original.participants.find((p: any) => p.nickname === "Bob").id,
        },
        alice,
      )
    ).status,
  ).toBe(200);
  const updated = await (
    await request(base + "/snapshot", "GET", undefined, alice)
  ).json();
  expect(updated.me.id).toBe(original.me.id);
  expect(updated.me.nickname).toBe("Alicia");
  expect(updated.publications[0].nickname).toBe("Alicia");
  expect(updated.participants.some((p: any) => p.nickname === "Bob")).toBe(
    true,
  );
  expect(
    (
      await request(
        base + "/messages/" + updated.publications[0].id,
        "PATCH",
        { text: "Corrigé" },
        alice,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        base + "/messages/" + updated.publications[0].id,
        "DELETE",
        undefined,
        bob,
      )
    ).status,
  ).toBe(403);
  expect(
    (await request(base + "/me", "PATCH", { nickname: "Alice" }, bob)).status,
  ).toBe(200);
  expect(
    (await request(base + "/me", "PATCH", { nickname: "Formateur corrigé" }, a))
      .status,
  ).toBe(200);
  expect(
    (
      await request(
        base + "/me",
        "PATCH",
        { nickname: "FORMATEUR CORRIGÉ" },
        alice,
      )
    ).status,
  ).toBe(409);
});

test("session settings save together and roll back entirely on conflicts", async () => {
  const a = await admin();
  const s = await session(a);
  const other = (
    await (
      await request(
        "/api/sessions",
        "POST",
        { title: "Autre formation", expiresAt: clock + 3600000 },
        a,
      )
    ).json()
  ).id;
  const base = "/api/sessions/" + s;
  const before = await (
    await request(base + "/snapshot", "GET", undefined, a)
  ).json();
  const otherSession = await (
    await request("/api/sessions/" + other, "GET", undefined, a)
  ).json();
  const guest = await client();
  await request(base + "/join", "POST", { nickname: "Alice" }, guest);
  const nextExpiry = clock + 7200000;
  expect(
    (
      await request(
        base,
        "PATCH",
        {
          nickname: "Nouveau nom",
          slug: otherSession.slug,
          expiresAt: nextExpiry,
        },
        a,
      )
    ).status,
  ).toBe(409);
  let state = await (
    await request(base + "/snapshot", "GET", undefined, a)
  ).json();
  expect(state.me.nickname).toBe(before.me.nickname);
  expect(state.session.slug).toBe(before.session.slug);
  expect(state.session.expiresAt).toBe(before.session.expiresAt);
  expect(
    (
      await request(
        base,
        "PATCH",
        { nickname: "alice", slug: "nouvelle-adresse", expiresAt: nextExpiry },
        a,
      )
    ).status,
  ).toBe(409);
  state = await (await request(base + "/snapshot", "GET", undefined, a)).json();
  expect(state.session.slug).toBe(before.session.slug);
  expect(state.session.expiresAt).toBe(before.session.expiresAt);
  expect(
    (
      await request(
        base,
        "PATCH",
        {
          nickname: "Nouveau nom",
          slug: "nouvelle-adresse",
          expiresAt: nextExpiry,
        },
        a,
      )
    ).status,
  ).toBe(200);
  state = await (await request(base + "/snapshot", "GET", undefined, a)).json();
  expect(state.me.nickname).toBe("Nouveau nom");
  expect(state.session.slug).toBe("nouvelle-adresse");
  expect(state.session.expiresAt).toBe(nextExpiry);
  expect(
    (await request(base + "/snapshot", "GET", undefined, guest)).status,
  ).toBe(200);
  // Old databases may contain the removed closure flag; it no longer blocks access.
  store.db.query("UPDATE sessions SET closed=1 WHERE id=?").run(s);
  expect(
    (await request(base + "/snapshot", "GET", undefined, guest)).status,
  ).toBe(200);
});

test("relative API deadlines are resolved by the server and settings leave them unchanged unless selected", async () => {
  const a = await admin();
  clock = Date.parse("2026-10-24T10:00:00Z");
  // Keep authentication valid after moving the test clock.
  store.db
    .query("UPDATE browsers SET admin_until=?, expires_at=?")
    .run(clock + 86_400_000, clock + 86_400_000);
  const created = await request(
    "/api/sessions",
    "POST",
    {
      title: "Durée",
      deadline: { kind: "duration", amount: 24, unit: "hours" },
    },
    a,
  );
  expect(created.status).toBe(201);
  expect(Number(created.headers.get("X-Server-Time"))).toBe(clock);
  const initial = await created.json();
  expect(initial.expiresAt).toBe(clock + 86_400_000);
  expect(initial.timeZone).toBe("Europe/Paris");
  const base = "/api/sessions/" + initial.id;
  clock += 600_000;
  const unchanged = await request(
    base,
    "PATCH",
    { nickname: "Nouveau nom", slug: "duree-modifiee" },
    a,
  );
  expect(unchanged.status).toBe(200);
  expect((await unchanged.json()).expiresAt).toBe(initial.expiresAt);
  const replacement = await request(
    base,
    "PATCH",
    { deadline: { kind: "duration", amount: 24, unit: "hours" } },
    a,
  );
  expect((await replacement.json()).expiresAt).toBe(clock + 86_400_000);
  const before = store.session(initial.id);
  const invalid = await request(
    base,
    "PATCH",
    {
      nickname: "À ne pas appliquer",
      deadline: { kind: "duration", amount: 0, unit: "days" },
    },
    a,
  );
  expect(invalid.status).toBe(400);
  expect(store.session(initial.id).expiresAt).toBe(before.expiresAt);
  expect(
    (await (await request(base + "/snapshot", "GET", undefined, a)).json()).me
      .nickname,
  ).toBe("Nouveau nom");
  const conflict = await request(
    base,
    "PATCH",
    {
      nickname: "Encore un nom",
      slug: "!invalide",
      deadline: { kind: "duration", amount: 7, unit: "days" },
    },
    a,
  );
  expect(conflict.status).toBe(400);
  expect(store.session(initial.id)).toEqual(before);
  clock = before.expiresAt;
  store.db
    .query("UPDATE browsers SET admin_until=?, expires_at=?")
    .run(clock + 86_400_000, clock + 86_400_000);
  expect(
    (
      await request(
        base,
        "PATCH",
        { deadline: { kind: "duration", amount: 7, unit: "days" } },
        a,
      )
    ).status,
  ).toBe(410);
});

test("API handles midnight choices and exact fallback without depending on the client timezone", async () => {
  const a = await admin();
  clock = Date.parse("2026-10-24T22:00:00Z");
  store.db
    .query("UPDATE browsers SET admin_until=?, expires_at=?")
    .run(clock + 86_400_000, clock + 86_400_000);
  const response = await request(
    "/api/sessions",
    "POST",
    { title: "Minuit", deadline: { kind: "tomorrow", day: "2026-10-25" } },
    a,
  );
  expect(response.status).toBe(201);
  const s = await response.json();
  expect(s.expiresAt).toBe(Date.parse("2026-10-26T23:00:00Z"));
  const base = "/api/sessions/" + s.id;
  expect(
    (
      await request(
        base,
        "PATCH",
        { deadline: { kind: "tonight", day: "2026-10-24" } },
        a,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        base,
        "PATCH",
        { deadline: { kind: "exact", local: "2026-10-25T02:30" } },
        a,
      )
    ).status,
  ).toBe(400);
  const exact = await request(
    base,
    "PATCH",
    { deadline: { kind: "exact", local: "2026-10-25T03:30" } },
    a,
  );
  expect(exact.status).toBe(200);
  expect((await exact.json()).expiresAt).toBe(
    Date.parse("2026-10-25T02:30:00Z"),
  );
  expect(
    (
      await request(
        base,
        "PATCH",
        {
          expiresAt: clock + 1_000,
          deadline: { kind: "duration", amount: 1, unit: "days" },
        },
        a,
      )
    ).status,
  ).toBe(400);
});
