import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { createApp } from "../src/server/app";
import { suggestAddress } from "../src/shared/address";

test("custom addresses are unique, editable, and independent of messages and participants", async () => {
  const directory = mkdtempSync(join(tmpdir(), "jlg-address-"));
  const store = new Store(directory);
  const origin = "http://test.local";
  const app = createApp(store, {
    origin,
    secure: false,
    passwordHash: await Bun.password.hash("address-test-password"),
  });
  let cookie = "";
  async function call(path: string, method = "GET", body?: unknown) {
    return (await app.fetch(
      new Request(origin + "/api" + path, {
        method,
        headers: { origin, cookie, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    ))!;
  }
  try {
    cookie = (await call("/me")).headers.get("set-cookie")!.split(";")[0];
    expect(
      (await call("/login", "POST", { password: "address-test-password" }))
        .status,
    ).toBe(200);
    const payload = {
      title: "Excel",
      expiresAt: Date.now() + 3600_000,
      slug: "excel",
    };
    const create = await call("/sessions", "POST", payload);
    expect(create.status).toBe(201);
    const session = await create.json();
    expect(session.slug).toBe("excel");
    expect((await call("/sessions", "POST", payload)).status).toBe(409);
    expect(store.db.query("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({
      n: 1,
    });
    for (const slug of [
      "api",
      "ws",
      "assets",
      "s",
      "admin",
      "../excel",
      "deux mots",
      "été",
      "a--b",
    ])
      expect(
        (await call("/sessions", "POST", { ...payload, slug })).status,
      ).toBe(400);
    await call("/sessions/excel/messages", "POST", {
      text: "Avant le changement",
    });
    const before = await (await call("/sessions/excel/snapshot")).json();
    expect(
      (await call("/sessions/excel", "PATCH", { slug: "excel-avance" })).status,
    ).toBe(200);
    expect((await call("/sessions/excel")).status).toBe(404);
    const after = await (await call("/sessions/excel-avance/snapshot")).json();
    expect(after.me.id).toBe(before.me.id);
    expect(after.publications[0].text).toBe("Avant le changement");
    expect(after.session.id).toBe(session.id);
    expect((await call("/sessions/" + session.id + "/snapshot")).status).toBe(
      200,
    );
    const failedPatch = await call("/sessions/" + session.id, "PATCH", {
      slug: "autre-adresse",
      expiresAt: 0,
    });
    expect(failedPatch.status).toBe(400);
    expect(store.address(session.id)).toBe("excel-avance");
  } finally {
    app.close();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("existing sessions receive readable addresses on restart without replacing their ids", () => {
  const directory = mkdtempSync(join(tmpdir(), "jlg-migrate-"));
  let store = new Store(directory);
  try {
    for (const id of ["old-identifier-one", "old-identifier-two"])
      store.db
        .query("INSERT INTO sessions VALUES (?,?,?,0,NULL)")
        .run(id, "GIA CV1", Date.now() + 3600_000);
    store.db.exec("DROP TABLE session_addresses");
    store.db.close();
    store = new Store(directory);
    expect(store.address("old-identifier-one")).toBe("gia-cv1");
    expect(store.address("old-identifier-two")).toBe("gia-cv1-2");
    expect(store.resolveSession("gia-cv1")).toBe("old-identifier-one");
    expect(suggestAddress("Débuter avec Excel !")).toBe("debuter-avec-excel");
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
