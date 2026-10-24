import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { createApp } from "../src/server/app";
const devProxy = process.env.E2E_DEV_PROXY === "1";
const directory = mkdtempSync(join(tmpdir(), "jlg-e2e-"));
const store = new Store(directory);
const app = createApp(store, {
  origin: devProxy ? "http://localhost:4174" : "http://127.0.0.1:4173",
  passwordHash: await Bun.password.hash("e2e-only-password"),
  secure: false,
});
const server = Bun.serve({
  port: 4173,
  hostname: "127.0.0.1",
  fetch: app.fetch,
  websocket: app.websocket,
  maxRequestBodySize: 50_100_000,
});
const vite = devProxy
  ? await (
      await import("vite")
    ).createServer({
      server: {
        host: "127.0.0.1",
        port: 4174,
        strictPort: true,
        proxy: {
          "/api": "http://127.0.0.1:4173",
          "/ws": { target: "ws://127.0.0.1:4173", ws: true },
        },
      },
    })
  : undefined;
await vite?.listen();
function stop() {
  void vite?.close();
  app.close();
  server.stop(true);
  store.db.close();
  rmSync(directory, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
