import { createHash, randomBytes } from "node:crypto";
import { renameSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { Server, ServerWebSocket } from "bun";
import { Store, AppError, fail, id, nickname } from "./store";
import { FILE_LIMIT } from "../shared/types";
import type { MediaService } from "./media";

export type Config = {
  origin: string;
  passwordHash: string;
  secure: boolean;
  dist?: string;
};
type SocketData = { sessionId: string; browserId: string };
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const cookieName = "jlg_browser";
const adminLifetime = 12 * 60 * 60 * 1000;
const browserLifetime = 90 * 24 * 60 * 60 * 1000;

export function createApp(store: Store, config: Config, media?: MediaService) {
  const sockets = new Set<ServerWebSocket<SocketData>>();
  const attempts = new Map<string, { count: number; reset: number }>();
  let expiryTimer: ReturnType<typeof setTimeout>;
  function rate(key: string, max = 12) {
    const now = Date.now();
    for (const [k, v] of attempts) if (v.reset <= now) attempts.delete(k);
    const row = attempts.get(key) ?? { count: 0, reset: now + 60_000 };
    row.count++;
    attempts.set(key, row);
    if (row.count > max)
      fail(429, "Trop de tentatives. Réessayez dans une minute.");
  }
  function browser(req: Request) {
    const token = req.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return "";
    const key = digest(token);
    return store.db
      .query("SELECT id FROM browsers WHERE id=? AND expires_at>?")
      .get(key, store.now())
      ? key
      : "";
  }
  function requireBrowser(req: Request) {
    const key = browser(req);
    if (!key) fail(401, "Rechargez la page pour vous reconnecter.");
    return key;
  }
  function ensureBrowser(req: Request) {
    let key = browser(req);
    let cookie: string | undefined;
    if (!key) {
      const token = randomBytes(32).toString("hex");
      key = digest(token);
      store.db
        .query("INSERT INTO browsers VALUES (?,0,?)")
        .run(key, store.now() + browserLifetime);
      cookie = `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${browserLifetime / 1000}${config.secure ? "; Secure" : ""}`;
    } else
      store.db
        .query("UPDATE browsers SET expires_at=? WHERE id=?")
        .run(store.now() + browserLifetime, key);
    return { key, cookie };
  }
  async function body(req: Request): Promise<Record<string, unknown>> {
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      fail(415, "Un contenu JSON est attendu.");
    const text = await req.text();
    if (text.length > 25_000) fail(413, "Le message est trop long.");
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      fail(400, "La demande est invalide.");
    }
    if (!result || typeof result !== "object" || Array.isArray(result))
      fail(400, "La demande est invalide.");
    return result as Record<string, unknown>;
  }
  function expiry(value: unknown) {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value <= store.now()
    )
      fail(
        400,
        "Choisissez une date et une heure de suppression dans le futur.",
      );
    return value;
  }
  function title(value: unknown) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
      fail(400, "Le titre doit contenir entre 1 et 120 caractères.");
    return value.trim();
  }
  function notify(sessionId: string) {
    for (const ws of sockets)
      if (ws.data.sessionId === sessionId) ws.send('{"type":"refresh"}');
  }
  function evict(sessionId: string) {
    for (const ws of sockets)
      if (ws.data.sessionId === sessionId) {
        ws.send('{"type":"expired"}');
        ws.close(1000, "Session terminée");
      }
  }
  function schedule() {
    clearTimeout(expiryTimer);
    const row = store.db
      .query("SELECT MIN(expires_at) AS next FROM sessions")
      .get() as { next: number | null };
    expiryTimer = setTimeout(
      () => {
        for (const sessionId of store.purge()) {
          evict(sessionId);
          void media?.end(sessionId).catch(() => {});
        }
        schedule();
      },
      row.next === null
        ? 60_000
        : Math.min(2_147_000_000, Math.max(1, row.next - store.now())),
    );
    expiryTimer.unref();
  }
  schedule();
  const healthTimer = setInterval(() => {
    for (const ws of sockets) {
      try {
        store.actor(ws.data.sessionId, ws.data.browserId);
      } catch {
        ws.close(1008, "Accès terminé");
      }
    }
  }, 15_000);
  healthTimer.unref();

  async function api(
    req: Request,
    url: URL,
    server?: Server<SocketData>,
  ): Promise<Response | undefined> {
    const path = url.pathname;
    const remote = server?.requestIP(req)?.address ?? "local";
    if (req.method !== "GET" && req.headers.get("origin") !== config.origin)
      fail(403, "Origine de la demande refusée.");
    if (path === "/api/health") return json({ ok: true });
    if (path === "/api/me" && req.method === "GET") {
      const b = ensureBrowser(req);
      const name = (
        store.db
          .query("SELECT value FROM settings WHERE key='admin_name'")
          .get() as { value: string }
      ).value;
      const response = json({ admin: store.isAdmin(b.key), name });
      if (b.cookie) response.headers.set("Set-Cookie", b.cookie);
      return response;
    }
    const browserId = requireBrowser(req);
    if (path === "/api/login" && req.method === "POST") {
      rate("login:" + remote, 8);
      const input = await body(req);
      if (
        typeof input.password !== "string" ||
        input.password.length > 256 ||
        !(await Bun.password.verify(input.password, config.passwordHash))
      )
        fail(401, "Mot de passe incorrect.");
      store.db
        .query("UPDATE browsers SET admin_until=? WHERE id=?")
        .run(store.now() + adminLifetime, browserId);
      return json({ ok: true });
    }
    if (path === "/api/logout" && req.method === "POST") {
      store.db
        .query("UPDATE browsers SET admin_until=0 WHERE id=?")
        .run(browserId);
      for (const ws of sockets)
        if (ws.data.browserId === browserId) ws.close(1008, "Déconnexion");
      return json({ ok: true });
    }
    if (path === "/api/settings" && req.method === "PATCH") {
      store.requireAdmin(browserId);
      const input = await body(req);
      store.requireAdmin(browserId);
      const name = nickname(input.name);
      // Keep every current session unambiguous when renaming the formateur.
      const owned = store.db
        .query("SELECT session_id AS id FROM participants WHERE admin=1")
        .all() as { id: string }[];
      store.db.transaction(() => {
        for (const s of owned) {
          const key = name.normalize("NFKC").toLocaleLowerCase("fr");
          const taken = store.db
            .query(
              "SELECT id FROM participants WHERE session_id=? AND name_key=? AND admin=0",
            )
            .get(s.id, key);
          if (taken)
            fail(
              409,
              "Ce nom est déjà utilisé par un stagiaire dans une session.",
            );
          store.db
            .query(
              "UPDATE participants SET nickname=?,name_key=? WHERE session_id=? AND admin=1",
            )
            .run(name, key, s.id);
        }
        store.db
          .query("UPDATE settings SET value=? WHERE key='admin_name'")
          .run(name);
      })();
      for (const s of owned) notify(s.id);
      return json({ ok: true });
    }
    if (path === "/api/sessions") {
      store.requireAdmin(browserId);
      if (req.method === "GET") {
        store.purge();
        return json(
          (
            store.db
              .query("SELECT id FROM sessions ORDER BY expires_at")
              .all() as { id: string }[]
          ).map((s) => store.session(s.id)),
        );
      }
      if (req.method === "POST") {
        const input = await body(req);
        const sessionTitle = title(input.title);
        const expiresAt = expiry(input.expiresAt);
        if (
          input.code !== undefined &&
          (typeof input.code !== "string" || input.code.length > 128)
        )
          fail(400, "Code invalide (128 caractères maximum).");
        const code = typeof input.code === "string" ? input.code.trim() : "";
        const hash = code
          ? await Bun.password.hash(code, { algorithm: "argon2id" })
          : null;
        store.requireAdmin(browserId);
        expiry(expiresAt);
        const sessionId =
          id().slice(0, 8) + "-" + randomBytes(3).toString("hex");
        store.db
          .query("INSERT INTO sessions VALUES (?,?,?,0,?)")
          .run(sessionId, sessionTitle, expiresAt, hash);
        const name = (
          store.db
            .query("SELECT value FROM settings WHERE key='admin_name'")
            .get() as { value: string }
        ).value;
        store.join(sessionId, browserId, name, true);
        schedule();
        return json(store.session(sessionId), 201);
      }
    }
    const match = path.match(/^\/api\/sessions\/([a-zA-Z0-9-]+)(?:\/(.*))?$/);
    if (!match) fail(404, "Adresse introuvable.");
    const sessionId = match[1];
    const action = match[2] ?? "";
    const s = store.raw(sessionId);
    if (!action && req.method === "GET")
      return json({
        id: s.id,
        title: s.title,
        expiresAt: s.expires_at,
        protected: !!s.code_hash,
        closed: !!s.closed,
      });
    if (action === "join" && req.method === "POST") {
      rate("join:" + remote, 30);
      const input = await body(req);
      const admin = store.isAdmin(browserId);
      const current = store.db
        .query(
          "SELECT id FROM participants WHERE session_id=? AND browser_id=?",
        )
        .get(sessionId, browserId);
      if (!admin && !current && s.code_hash) {
        if (
          typeof input.code !== "string" ||
          input.code.length > 128 ||
          !(await Bun.password.verify(input.code, s.code_hash))
        )
          fail(403, "Code d’accès incorrect.");
      }
      const name = admin
        ? (
            store.db
              .query("SELECT value FROM settings WHERE key='admin_name'")
              .get() as { value: string }
          ).value
        : input.nickname;
      if (!current) nickname(name);
      const result = store.join(sessionId, browserId, name as string, admin);
      notify(sessionId);
      return json(result);
    }
    if (!action && req.method === "PATCH") {
      store.requireAdmin(browserId);
      const input = await body(req);
      store.requireAdmin(browserId);
      store.raw(sessionId);
      if (input.expiresAt !== undefined)
        store.db
          .query("UPDATE sessions SET expires_at=? WHERE id=?")
          .run(expiry(input.expiresAt), sessionId);
      if (input.closed !== undefined) {
        if (typeof input.closed !== "boolean") fail(400, "État invalide.");
        store.db
          .query("UPDATE sessions SET closed=? WHERE id=?")
          .run(input.closed ? 1 : 0, sessionId);
      }
      schedule();
      notify(sessionId);
      if (input.closed === true)
        for (const ws of sockets)
          if (
            ws.data.sessionId === sessionId &&
            !store.isAdmin(ws.data.browserId)
          )
            ws.close(1008, "Session fermée");
      if (input.closed === true) await media?.end(sessionId);
      return json(store.session(sessionId));
    }
    if (!action && req.method === "DELETE") {
      store.requireAdmin(browserId);
      store.deleteSession(sessionId);
      evict(sessionId);
      await media?.end(sessionId);
      schedule();
      return json({ ok: true });
    }
    const actor = store.actor(sessionId, browserId);
    if (action === "snapshot" && req.method === "GET") {
      const participants = store.db
        .query(
          "SELECT id,nickname,admin FROM participants WHERE session_id=? ORDER BY admin DESC,nickname",
        )
        .all(sessionId)
        .map((p) => ({
          ...(p as object),
          admin: !!(p as { admin: number }).admin,
        }));
      return json({
        session: store.session(sessionId),
        me: actor,
        publications: store.publications(sessionId),
        participants,
      });
    }
    if (action === "messages" && req.method === "POST") {
      rate("message:" + browserId, 100);
      const input = await body(req);
      store.actor(sessionId, browserId);
      if (
        typeof input.text !== "string" ||
        !input.text.trim() ||
        input.text.length > 20_000
      )
        fail(400, "Le message doit contenir entre 1 et 20 000 caractères.");
      store.db
        .query(
          "INSERT INTO publications (id,session_id,participant_id,kind,text,created_at) VALUES (?,?,?,'text',?,?)",
        )
        .run(id(), sessionId, actor.id, input.text, store.now());
      notify(sessionId);
      return json({ ok: true }, 201);
    }
    const publication = action.match(/^(?:messages|files)\/([a-f0-9-]+)$/);
    if (publication) {
      const publicationId = publication[1];
      const row = store.db
        .query("SELECT * FROM publications WHERE id=? AND session_id=?")
        .get(publicationId, sessionId) as {
        participant_id: string;
        kind: string;
        filename: string;
        size: number;
      } | null;
      if (!row) fail(404, "Cette publication a été supprimée.");
      if (req.method === "GET" && row.kind === "file") {
        const file = Bun.file(store.path(publicationId));
        if (!(await file.exists()))
          fail(404, "Ce fichier n’est plus disponible.");
        store.actor(sessionId, browserId);
        const reader = file.stream().getReader();
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              store.actor(sessionId, browserId);
              if (
                !store.db
                  .query("SELECT id FROM publications WHERE id=?")
                  .get(publicationId)
              )
                throw new Error("Supprimé");
              const chunk = await reader.read();
              if (chunk.done) controller.close();
              else controller.enqueue(chunk.value);
            } catch {
              await reader.cancel();
              controller.error(new Error("Téléchargement terminé."));
            }
          },
          cancel() {
            return reader.cancel();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(row.size),
            "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (req.method === "PATCH") {
        if (row.kind !== "text" || row.participant_id !== actor.id)
          fail(403, "Vous pouvez modifier uniquement vos propres messages.");
        const input = await body(req);
        store.actor(sessionId, browserId);
        if (
          typeof input.text !== "string" ||
          !input.text.trim() ||
          input.text.length > 20_000
        )
          fail(400, "Message vide ou trop long.");
        store.db
          .query(
            "UPDATE publications SET text=?,edited_at=? WHERE id=? AND session_id=?",
          )
          .run(input.text, store.now(), publicationId, sessionId);
        notify(sessionId);
        return json({ ok: true });
      }
      if (req.method === "DELETE") {
        if (!actor.admin && row.participant_id !== actor.id)
          fail(
            403,
            "Vous pouvez supprimer uniquement vos propres publications.",
          );
        if (row.kind === "file") store.removeFile(publicationId);
        store.db
          .query("DELETE FROM publications WHERE id=? AND session_id=?")
          .run(publicationId, sessionId);
        notify(sessionId);
        return json({ ok: true });
      }
    }
    if (action === "files" && req.method === "POST") {
      rate("upload:" + browserId, 20);
      let filename: string;
      try {
        filename = decodeURIComponent(req.headers.get("x-file-name") ?? "");
      } catch {
        fail(400, "Nom de fichier invalide.");
      }
      filename = filename
        .replace(/[\\/\p{Cc}\p{Cf}]/gu, "_")
        .slice(0, 200)
        .trim();
      if (!filename) fail(400, "Le fichier doit avoir un nom.");
      const size = Number(req.headers.get("x-file-size"));
      if (!Number.isSafeInteger(size) || size < 1 || size > FILE_LIMIT)
        fail(413, "Chaque fichier doit contenir entre 1 octet et 50 Mo.");
      if (!req.body) fail(400, "Fichier absent.");
      const uploadId = id();
      store.reserve(sessionId, uploadId, size);
      const writer = Bun.file(store.path(uploadId + ".part")).writer();
      const reader = req.body.getReader();
      let received = 0;
      let complete = false;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          if (received > size || received > FILE_LIMIT)
            fail(
              413,
              "Le fichier dépasse la taille annoncée ou la limite de 50 Mo.",
            );
          store.actor(sessionId, browserId);
          writer.write(chunk.value);
          await writer.flush();
        }
        await writer.end();
        if (received !== size) fail(400, "Le dépôt est incomplet. Réessayez.");
        store.actor(sessionId, browserId);
        renameSync(store.path(uploadId + ".part"), store.path(uploadId));
        store.db.transaction(() => {
          store.actor(sessionId, browserId);
          store.db
            .query(
              "INSERT INTO publications (id,session_id,participant_id,kind,filename,size,created_at) VALUES (?,?,?,'file',?,?,?)",
            )
            .run(uploadId, sessionId, actor.id, filename, size, store.now());
          store.db.query("DELETE FROM uploads WHERE id=?").run(uploadId);
        })();
        complete = true;
        notify(sessionId);
        return json({ ok: true }, 201);
      } finally {
        await reader.cancel().catch(() => {});
        await Promise.resolve(writer.end()).catch(() => {});
        store.db.query("DELETE FROM uploads WHERE id=?").run(uploadId);
        store.removeFile(uploadId + ".part");
        if (!complete) store.removeFile(uploadId);
      }
    }
    if (action === "media" && req.method === "POST") {
      if (!media)
        fail(
          503,
          "Le partage d’écran n’est pas encore configuré sur ce serveur.",
        );
      const input = await body(req);
      store.actor(sessionId, browserId);
      if (input.publish === true && !actor.admin)
        fail(403, "Seul le formateur peut diffuser son écran.");
      const token = await media.access(
        sessionId,
        actor.id,
        actor.admin && input.publish === true,
        s.expires_at,
        browserId,
      );
      store.actor(sessionId, browserId);
      return json(token);
    }
    if (action === "media/stop" && req.method === "POST") {
      store.requireAdmin(browserId);
      await media?.end(sessionId);
      notify(sessionId);
      return json({ ok: true });
    }
    fail(404, "Adresse introuvable.");
  }
  async function fetch(
    req: Request,
    server?: Server<SocketData>,
  ): Promise<Response | undefined> {
    try {
      const url = new URL(req.url);
      if (
        url.pathname === "/api/media/webhook" &&
        req.method === "POST" &&
        media
      ) {
        const result = await media.webhook(
          await req.text(),
          req.headers.get("authorization") ?? "",
        );
        return json(result);
      }
      if (url.pathname === "/ws") {
        if (req.headers.get("origin") !== config.origin)
          fail(403, "Origine refusée.");
        const browserId = requireBrowser(req);
        const sessionId = url.searchParams.get("session") ?? "";
        store.actor(sessionId, browserId);
        if (server?.upgrade(req, { data: { sessionId, browserId } })) return;
        fail(400, "Connexion temps réel indisponible.");
      }
      let response: Response;
      if (url.pathname.startsWith("/api/"))
        response = (await api(req, url, server))!;
      else {
        if (req.method !== "GET" && req.method !== "HEAD")
          fail(405, "Méthode non autorisée.");
        const root = resolve(config.dist ?? "dist");
        const requested = resolve(root, "." + decodeURIComponent(url.pathname));
        if (requested !== root && !requested.startsWith(root + sep))
          fail(404, "Adresse introuvable.");
        const candidate = Bun.file(requested);
        const file = (await candidate.exists())
          ? candidate
          : Bun.file(resolve(root, "index.html"));
        if (!(await file.exists()))
          return new Response(
            "Interface non construite : lancez bun run build.",
            { status: 503 },
          );
        response = new Response(req.method === "HEAD" ? null : file, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("Permissions-Policy", "camera=(), microphone=()");
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      return response;
    } catch (e) {
      if (e instanceof AppError) return json({ error: e.message }, e.status);
      // Do not log request bodies, access links, names or secrets.
      console.error("Erreur interne", e instanceof Error ? e.name : "unknown");
      return json({ error: "Une erreur est survenue. Réessayez." }, 500);
    }
  }
  return {
    fetch,
    websocket: {
      open(ws: ServerWebSocket<SocketData>) {
        sockets.add(ws);
        ws.send('{"type":"refresh"}');
      },
      message(ws: ServerWebSocket<SocketData>) {
        try {
          store.actor(ws.data.sessionId, ws.data.browserId);
          ws.send('{"type":"refresh"}');
        } catch {
          ws.close(1008, "Accès terminé");
        }
      },
      close(ws: ServerWebSocket<SocketData>) {
        sockets.delete(ws);
      },
      maxPayloadLength: 1024,
      idleTimeout: 60,
    },
    close() {
      clearTimeout(expiryTimer);
      clearInterval(healthTimer);
      for (const ws of sockets) ws.close();
    },
  };
}
