import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { createApp } from "../src/server/app";

test("twenty real WebSocket viewers receive publication changes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "jlg-realtime-"));
  const store = new Store(directory);
  const origin = "http://test.local";
  const app = createApp(store, {
    origin,
    secure: false,
    passwordHash: await Bun.password.hash("realtime-test-password"),
  });
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: app.fetch,
    websocket: app.websocket,
  });
  const base = `http://127.0.0.1:${server.port}`;
  const sockets: WebSocket[] = [];
  async function call(path: string, cookie: string, data?: unknown) {
    return fetch(base + "/api" + path, {
      method: data ? "POST" : "GET",
      headers: { origin, cookie, "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  try {
    const adminCookie = (await call("/me", "")).headers
      .get("set-cookie")!
      .split(";")[0];
    await call("/login", adminCookie, { password: "realtime-test-password" });
    const session = await (
      await call("/sessions", adminCookie, {
        title: "20 spectateurs",
        expiresAt: Date.now() + 60_000,
      })
    ).json();
    for (let i = 0; i < 20; i++) {
      const cookie = (await call("/me", "")).headers
        .get("set-cookie")!
        .split(";")[0];
      expect(
        (
          await call(`/sessions/${session.id}/join`, cookie, {
            nickname: "Stagiaire " + i,
          })
        ).status,
      ).toBe(200);
      const BunWebSocket = WebSocket as unknown as {
        new (
          url: string,
          options: { headers: Record<string, string> },
        ): WebSocket;
      };
      const ws = new BunWebSocket(
        `ws://127.0.0.1:${server.port}/ws?session=${session.id}`,
        { headers: { Origin: origin, Cookie: cookie } },
      );
      sockets.push(ws);
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("message", () => resolve(), { once: true });
        ws.addEventListener("error", reject, { once: true });
      });
    }
    const received = sockets.map(
      (ws) =>
        new Promise<void>((resolve) =>
          ws.addEventListener("message", () => resolve(), { once: true }),
        ),
    );
    expect(
      (
        await call(`/sessions/${session.id}/messages`, adminCookie, {
          text: "Bonjour à tous les vingt !",
        })
      ).status,
    ).toBe(201);
    await Promise.all(received);
    expect(sockets).toHaveLength(20);
  } finally {
    sockets.forEach((s) => s.close());
    app.close();
    await server.stop(true);
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 15_000);
