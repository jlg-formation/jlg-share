import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store";
import { LiveKitMedia } from "../src/server/livekit";
test("screen grants exclude camera and microphone, single publisher across sessions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jlg-media-"));
  const store = new Store(dir);
  let rooms: any[] = [];
  const transport = {
    listRooms: async () => rooms,
    listParticipants: async () => [],
    removeParticipant: async () => {},
    deleteRoom: async () => {},
  };
  const media = new LiveKitMedia(
    store,
    {
      url: "wss://media.test",
      apiUrl: "http://media.test",
      key: "testkey",
      secret: "test-secret-at-least-thirty-two-characters",
    },
    transport,
  );
  try {
    const time = Date.now() + 3600_000;
    store.db
      .query("INSERT INTO browsers VALUES (?,?,?)")
      .run("admin", time, time);
    for (const s of ["one", "two"]) {
      store.db
        .query("INSERT INTO sessions VALUES (?,?,?,0,NULL)")
        .run(s, s, time);
      store.join(s, "admin", "Formateur", true);
    }
    const actor = store.actor("one", "admin");
    const viewer = await media.access("one", "guest", false, time);
    const v = JSON.parse(
      Buffer.from(viewer.token.split(".")[1], "base64url").toString(),
    );
    expect(v.video.canPublish).toBe(false);
    expect(v.video.canPublishData).toBe(false);
    expect(v.video.canPublishSources).toEqual([]);
    const results = await Promise.allSettled([
      media.access("one", actor.id, true, time),
      media.access("two", store.actor("two", "admin").id, true, time),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const token = (results[0] as PromiseFulfilledResult<{ token: string }>)
      .value.token;
    const p = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    expect(p.video.canPublishSources).toEqual(["screen_share"]);
    expect(p.exp - p.nbf).toBeLessThanOrEqual(30);
    await media.end("one");
    expect(store.db.query("SELECT active FROM media_lease").get()).toEqual({
      active: 0,
    });
    await expect(media.webhook("{}", "invalid")).rejects.toThrow(
      "non autorisée",
    );
  } finally {
    media.close();
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
