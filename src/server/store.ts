import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Session, Participant, Publication } from "../shared/types";
import { SESSION_LIMIT } from "../shared/types";
import { suggestAddress, reservedAddresses } from "../shared/address";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new AppError(status, message);
}
export const id = () => crypto.randomUUID();
export function nameKey(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("fr");
}
export function nickname(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 40 ||
    /[\p{Cc}\p{Cf}]/u.test(value)
  )
    fail(400, "Choisissez un pseudo de 1 à 40 caractères.");
  if (/\(admin\)/i.test(value))
    fail(400, "La mention (admin) est réservée au formateur.");
  return value.trim();
}
type RawSession = {
  id: string;
  title: string;
  expires_at: number;
  code_hash: string | null;
};
type ActorRow = {
  id: string;
  nickname: string;
  admin: number;
  browser_id: string;
};
export class Store {
  db: Database;
  constructor(
    public directory: string,
    public now: () => number = Date.now,
  ) {
    mkdirSync(join(directory, "files"), { recursive: true });
    this.db = new Database(join(directory, "share.sqlite"), { create: true });
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS browsers (id TEXT PRIMARY KEY, admin_until INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO settings VALUES ('admin_name','Formateur');
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, expires_at INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0, code_hash TEXT);
      CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, browser_id TEXT NOT NULL REFERENCES browsers(id), nickname TEXT NOT NULL, name_key TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, UNIQUE(session_id,name_key), UNIQUE(session_id,browser_id));
      CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, participant_id TEXT NOT NULL REFERENCES participants(id), kind TEXT NOT NULL, text TEXT, filename TEXT, size INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, edited_at INTEGER);
      CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, size INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS publications_session ON publications(session_id,created_at);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS session_addresses (slug TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE)",
    );
    for (const row of this.db.query("SELECT id FROM sessions").all() as {
      id: string;
    }[])
      this.address(row.id);
    // A single application process owns this directory. Incomplete uploads cannot survive a restart.
    this.db.exec("DELETE FROM uploads");
    this.purge();
    const keep = new Set(
      (
        this.db
          .query("SELECT id FROM publications WHERE kind='file'")
          .all() as { id: string }[]
      ).map((r) => r.id),
    );
    for (const entry of readdirSync(join(directory, "files")))
      if (!keep.has(entry)) unlinkSync(join(directory, "files", entry));
  }
  resolveSession(reference: string): string {
    const row = this.db
      .query("SELECT session_id FROM session_addresses WHERE slug=?")
      .get(reference.toLowerCase()) as { session_id: string } | null;
    return row?.session_id ?? reference;
  }
  validateAddress(value: unknown): string {
    if (typeof value !== "string")
      fail(400, "Choisissez une adresse pour la session.");
    const slug = value.trim().toLowerCase();
    if (
      slug.length < 1 ||
      slug.length > 60 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      reservedAddresses.has(slug)
    )
      fail(
        400,
        "Adresse invalide : utilisez des lettres sans accent, des chiffres et des tirets (60 caractères maximum).",
      );
    return slug;
  }
  setAddress(sessionId: string, value: unknown): string {
    const slug = this.validateAddress(value);
    const taken = this.db
      .query("SELECT session_id FROM session_addresses WHERE slug=?")
      .get(slug) as { session_id: string } | null;
    const internal = this.db
      .query("SELECT id FROM sessions WHERE id=? AND id<>?")
      .get(slug, sessionId);
    if ((taken && taken.session_id !== sessionId) || internal)
      fail(409, "Cette adresse est déjà utilisée. Choisissez-en une autre.");
    this.db
      .query(
        "INSERT INTO session_addresses (slug,session_id) VALUES (?,?) ON CONFLICT(session_id) DO UPDATE SET slug=excluded.slug",
      )
      .run(slug, sessionId);
    return slug;
  }
  address(sessionId: string): string {
    const existing = this.db
      .query("SELECT slug FROM session_addresses WHERE session_id=?")
      .get(sessionId) as { slug: string } | null;
    if (existing) return existing.slug;
    const row = this.db
      .query("SELECT title FROM sessions WHERE id=?")
      .get(sessionId) as { title: string } | null;
    if (!row) fail(404, "Session introuvable.");
    let base = suggestAddress(row.title) || "session";
    if (reservedAddresses.has(base)) base = "session";
    let slug = base;
    let suffix = 2;
    while (
      this.db
        .query("SELECT slug FROM session_addresses WHERE slug=?")
        .get(slug) ||
      this.db
        .query("SELECT id FROM sessions WHERE id=? AND id<>?")
        .get(slug, sessionId)
    )
      slug = base.slice(0, 54) + "-" + suffix++;
    return this.setAddress(sessionId, slug);
  }
  path(fileId: string) {
    return join(this.directory, "files", fileId);
  }
  removeFile(fileId: string) {
    try {
      unlinkSync(this.path(fileId));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  purge(): string[] {
    const expired = this.db
      .query("SELECT id FROM sessions WHERE expires_at<=?")
      .all(this.now()) as { id: string }[];
    for (const row of expired) this.deleteSession(row.id);
    this.db
      .query(
        "DELETE FROM browsers WHERE expires_at<=? AND id NOT IN (SELECT browser_id FROM participants)",
      )
      .run(this.now());
    return expired.map((s) => s.id);
  }
  deleteSession(sessionId: string) {
    const files = this.db
      .query(
        "SELECT id FROM publications WHERE session_id=? AND kind='file' UNION SELECT id FROM uploads WHERE session_id=?",
      )
      .all(sessionId, sessionId) as { id: string }[];
    for (const file of files) {
      this.removeFile(file.id);
      this.removeFile(file.id + ".part");
    }
    this.db.query("DELETE FROM sessions WHERE id=?").run(sessionId);
  }
  raw(sessionId: string): RawSession {
    const s = this.db
      .query("SELECT * FROM sessions WHERE id=?")
      .get(sessionId) as RawSession | null;
    if (!s) fail(404, "Cette session est introuvable ou a été supprimée.");
    if (s.expires_at <= this.now()) {
      this.deleteSession(sessionId);
      fail(410, "Cette session a expiré. Ses ressources ont été supprimées.");
    }
    return s;
  }
  session(sessionId: string): Session {
    const s = this.raw(sessionId);
    const usage = this.db
      .query(
        "SELECT COALESCE(SUM(size),0) AS size FROM publications WHERE session_id=? AND kind='file'",
      )
      .get(sessionId) as { size: number };
    return {
      id: s.id,
      slug: this.address(s.id),
      title: s.title,
      expiresAt: s.expires_at,
      protected: !!s.code_hash,
      usedBytes: usage.size,
    };
  }
  isAdmin(browserId: string) {
    const b = this.db
      .query("SELECT admin_until FROM browsers WHERE id=? AND expires_at>?")
      .get(browserId, this.now()) as { admin_until: number } | null;
    return !!b && b.admin_until > this.now();
  }
  requireAdmin(browserId: string) {
    if (!this.isAdmin(browserId))
      fail(401, "Connectez-vous à votre espace administrateur.");
  }
  actor(sessionId: string, browserId: string): Participant {
    this.raw(sessionId);
    let p = this.db
      .query("SELECT * FROM participants WHERE session_id=? AND browser_id=?")
      .get(sessionId, browserId) as ActorRow | null;
    if (!p && this.isAdmin(browserId))
      p = this.db
        .query("SELECT * FROM participants WHERE session_id=? AND admin=1")
        .get(sessionId) as ActorRow | null;
    if (!p) fail(403, "Rejoignez la session avec votre pseudo.");
    if (p.admin) this.requireAdmin(browserId);
    return { id: p.id, nickname: p.nickname, admin: !!p.admin };
  }
  join(
    sessionId: string,
    browserId: string,
    requestedName: string,
    admin: boolean,
  ): Participant {
    return this.db.transaction(() => {
      this.raw(sessionId);
      if (admin) this.requireAdmin(browserId);
      const existing = this.db
        .query("SELECT * FROM participants WHERE session_id=? AND browser_id=?")
        .get(sessionId, browserId) as ActorRow | null;
      if (
        existing ||
        (admin &&
          this.db
            .query("SELECT id FROM participants WHERE session_id=? AND admin=1")
            .get(sessionId))
      )
        return this.actor(sessionId, browserId);
      const n = nickname(requestedName);
      const taken = this.db
        .query("SELECT id FROM participants WHERE session_id=? AND name_key=?")
        .get(sessionId, nameKey(n));
      if (taken)
        fail(
          409,
          "Ce pseudo est déjà utilisé dans cette session. Choisissez-en un autre.",
        );
      const participantId = id();
      this.db
        .query("INSERT INTO participants VALUES (?,?,?,?,?,?)")
        .run(participantId, sessionId, browserId, n, nameKey(n), admin ? 1 : 0);
      return { id: participantId, nickname: n, admin };
    })();
  }
  rename(sessionId: string, browserId: string, value: unknown): Participant {
    const name = nickname(value);
    return this.db.transaction(() => {
      const current = this.actor(sessionId, browserId);
      const taken = this.db
        .query(
          "SELECT id FROM participants WHERE session_id=? AND name_key=? AND id<>?",
        )
        .get(sessionId, nameKey(name), current.id);
      if (taken)
        fail(
          409,
          "Ce pseudo est déjà utilisé dans cette session. Choisissez-en un autre.",
        );
      this.db
        .query("UPDATE participants SET nickname=?,name_key=? WHERE id=?")
        .run(name, nameKey(name), current.id);
      return this.actor(sessionId, browserId);
    })();
  }
  publications(sessionId: string): Publication[] {
    return this.db
      .query(
        `SELECT p.id, p.participant_id AS participantId, a.nickname, a.admin, p.kind, p.text, p.filename, p.size, p.created_at AS createdAt, p.edited_at AS editedAt FROM publications p JOIN participants a ON a.id=p.participant_id WHERE p.session_id=? ORDER BY p.created_at,p.rowid`,
      )
      .all(sessionId)
      .map((row) => ({
        ...(row as Publication),
        admin: !!(row as Publication).admin,
      }));
  }
  reserve(sessionId: string, uploadId: string, size: number) {
    this.db.transaction(() => {
      this.raw(sessionId);
      const usage = this.db
        .query(
          "SELECT (SELECT COALESCE(SUM(size),0) FROM publications WHERE session_id=?) + (SELECT COALESCE(SUM(size),0) FROM uploads WHERE session_id=?) AS size",
        )
        .get(sessionId, sessionId) as { size: number };
      if (usage.size + size > SESSION_LIMIT)
        fail(413, "La session ne peut pas dépasser 1 Go de fichiers.");
      const active = this.db
        .query("SELECT COUNT(*) AS n FROM uploads")
        .get() as { n: number };
      if (active.n >= 8)
        fail(429, "Des dépôts sont en cours. Réessayez dans un instant.");
      this.db
        .query("INSERT INTO uploads VALUES (?,?,?)")
        .run(uploadId, sessionId, size);
    })();
  }
}
