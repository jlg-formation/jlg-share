import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from "livekit-server-sdk";
import { Store, fail, id } from "./store";
import type { MediaService } from "./media";
type Lease = {
  session_id: string;
  participant_id: string;
  browser_id: string;
  identity: string;
  release_after: number;
  active: number;
};
export type LiveKitConfig = {
  url: string;
  apiUrl: string;
  key: string;
  secret: string;
};
export class LiveKitMedia implements MediaService {
  private client: Pick<
    RoomServiceClient,
    "listRooms" | "listParticipants" | "removeParticipant" | "deleteRoom"
  >;
  private receiver: WebhookReceiver;
  private timer: ReturnType<typeof setInterval>;
  private reconciling = false;
  constructor(
    private store: Store,
    private config: LiveKitConfig,
    transport?: Pick<
      RoomServiceClient,
      "listRooms" | "listParticipants" | "removeParticipant" | "deleteRoom"
    >,
  ) {
    this.client =
      transport ??
      new RoomServiceClient(config.apiUrl, config.key, config.secret);
    this.receiver = new WebhookReceiver(config.key, config.secret);
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS media_lease (singleton INTEGER PRIMARY KEY CHECK(singleton=1),session_id TEXT NOT NULL,participant_id TEXT NOT NULL,browser_id TEXT NOT NULL,identity TEXT NOT NULL,release_after INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 0)",
    );
    this.timer = setInterval(() => {
      void this.reconcile();
    }, 5000);
    this.timer.unref();
    void this.reconcile();
  }
  private lease() {
    return this.store.db
      .query("SELECT * FROM media_lease WHERE singleton=1")
      .get() as Lease | null;
  }
  private authorized(lease: Lease) {
    try {
      const p = this.store.db
        .query(
          "SELECT browser_id FROM participants WHERE id=? AND session_id=? AND admin=1",
        )
        .get(lease.participant_id, lease.session_id) as {
        browser_id: string;
      } | null;
      if (!p) return false;
      this.store.actor(lease.session_id, lease.browser_id);
      return true;
    } catch {
      return false;
    }
  }
  async access(
    sessionId: string,
    participantId: string,
    publish: boolean,
    expiresAt: number,
    browserId?: string,
  ) {
    this.store.raw(sessionId);
    const identity = participantId + ":" + id();
    if (publish) {
      this.store.db.transaction(() => {
        if (this.lease())
          fail(
            409,
            "Un partage est déjà actif ou se termine sur le serveur. Réessayez dans quelques secondes.",
          );
        this.store.db
          .query("INSERT INTO media_lease VALUES (1,?,?,?,?,?,0)")
          .run(
            sessionId,
            participantId,
            browserId ??
              (
                this.store.db
                  .query("SELECT browser_id FROM participants WHERE id=?")
                  .get(participantId) as { browser_id: string }
              ).browser_id,
            identity,
            this.store.now() + 35_000,
          );
      })();
    }
    try {
      const seconds = Math.max(
        1,
        Math.min(30, Math.floor((expiresAt - this.store.now()) / 1000)),
      );
      const token = new AccessToken(this.config.key, this.config.secret, {
        identity,
        ttl: seconds,
      });
      token.addGrant({
        roomJoin: true,
        room: sessionId,
        canPublish: publish,
        canSubscribe: true,
        canPublishData: false,
        canUpdateOwnMetadata: false,
        canPublishSources: publish ? [TrackSource.SCREEN_SHARE] : [],
      });
      return { url: this.config.url, token: await token.toJwt() };
    } catch (e) {
      if (publish)
        this.store.db
          .query("DELETE FROM media_lease WHERE identity=?")
          .run(identity);
      throw e;
    }
  }
  async end(sessionId: string) {
    const lease = this.lease();
    if (lease?.session_id === sessionId) {
      // Keep a brief retirement period so an outstanding initial token cannot overlap a new publisher.
      this.store.db
        .query(
          "UPDATE media_lease SET active=0,release_after=? WHERE singleton=1",
        )
        .run(this.store.now() + 35_000);
      try {
        await this.client.removeParticipant(sessionId, lease.identity);
      } catch {
        /* Reconciliation retries; do not free the lock on a network failure. */
      }
    }
    let closed = true;
    try {
      closed = this.store.raw(sessionId).closed === 1;
    } catch {}
    if (closed)
      try {
        await this.client.deleteRoom(sessionId);
      } catch {}
  }
  async webhook(body: string, authorization: string) {
    if (body.length > 100_000) fail(413, "Notification trop volumineuse.");
    let event;
    try {
      event = await this.receiver.receive(body, authorization);
    } catch {
      fail(401, "Notification média non autorisée.");
    }
    const room = event.room?.name,
      identity = event.participant?.identity;
    if (!room) return { ok: true };
    try {
      const s = this.store.raw(room);
      if (s.closed) throw new Error("closed");
    } catch {
      try {
        await this.client.deleteRoom(room);
      } catch {}
      return { ok: true };
    }
    const lease = this.lease();
    if (event.event === "track_published") {
      if (
        !lease ||
        lease.session_id !== room ||
        lease.identity !== identity ||
        !this.authorized(lease) ||
        event.track?.source !== TrackSource.SCREEN_SHARE
      ) {
        if (identity) await this.client.removeParticipant(room, identity);
        return { ok: true };
      }
      this.store.db
        .query("UPDATE media_lease SET active=1 WHERE identity=?")
        .run(identity);
    }
    if (
      (event.event === "participant_left" ||
        event.event === "track_unpublished") &&
      lease?.identity === identity
    )
      await this.end(room);
    return { ok: true };
  }
  private async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      // Also remove abandoned rooms, including viewers, after expiry or closure.
      const rooms = await this.client.listRooms();
      for (const room of rooms) {
        try {
          if (this.store.raw(room.name).closed)
            await this.client.deleteRoom(room.name);
        } catch {
          await this.client.deleteRoom(room.name);
        }
      }
      const lease = this.lease();
      if (!lease) return;
      if (!this.authorized(lease)) {
        if (lease.active) {
          await this.end(lease.session_id);
        } else if (this.store.now() >= lease.release_after) {
          if (rooms.some((r) => r.name === lease.session_id))
            await this.client.removeParticipant(
              lease.session_id,
              lease.identity,
            );
          this.store.db
            .query("DELETE FROM media_lease WHERE identity=?")
            .run(lease.identity);
        }
        return;
      }
      const roomExists = rooms.some((r) => r.name === lease.session_id);
      const participants = roomExists
        ? await this.client.listParticipants(lease.session_id)
        : [];
      const publisher = participants.find((p) => p.identity === lease.identity);
      if (
        publisher?.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE)
      ) {
        this.store.db
          .query("UPDATE media_lease SET active=1 WHERE identity=?")
          .run(lease.identity);
        return;
      }
      if (lease.active) {
        await this.end(lease.session_id);
        return;
      }
      if (this.store.now() >= lease.release_after) {
        if (publisher)
          await this.client.removeParticipant(lease.session_id, lease.identity);
        this.store.db
          .query("DELETE FROM media_lease WHERE identity=?")
          .run(lease.identity);
      }
    } catch {
      /* Fail closed: a media service outage must not permit a second publisher. */
    } finally {
      this.reconciling = false;
    }
  }
  close() {
    clearInterval(this.timer);
  }
}
