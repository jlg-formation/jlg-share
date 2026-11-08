import type { Publication, Session } from "../shared/types";
import { fail, type Store } from "./store";

const markdown = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~-]/g, "\\$&");

function fileName(name: string) {
  // Prefixes below avoid Windows reserved names and collisions, even ignoring case.
  return (
    [...name.normalize("NFC").replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, "_")]
      .slice(0, 100)
      .join("")
      .replace(/[. ]+$/, "") || "fichier"
  );
}

export function discussion(
  session: Session,
  publications: Publication[],
  exportedAt: number,
) {
  const format = (date: number) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: session.timeZone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  const files = new Map<string, string>();
  for (const p of publications)
    if (p.kind === "file")
      files.set(
        p.id,
        `fichiers/${files.size + 1}-${fileName(p.filename ?? "fichier")}`,
      );
  const lines = [
    `# ${markdown(session.title)}`,
    "",
    `Export du ${format(exportedAt)} · ${session.timeZone}`,
    "",
    `Suppression de la session : ${format(session.expiresAt)}.`,
    "",
    "Cette archive contient les messages et fichiers présents au moment de l’export. Les messages supprimés et les anciennes versions ne sont pas conservés.",
    "",
    "Extraire le ZIP en entier avant d’ouvrir ce document pour utiliser les liens vers les fichiers.",
    "",
  ];
  if (!publications.length) lines.push("Aucun message ni fichier partagé.", "");
  for (const p of publications) {
    lines.push(
      `## ${markdown(p.nickname)}${p.admin ? " (admin)" : ""} — ${format(p.createdAt)}`,
      "",
    );
    if (p.editedAt) lines.push(`Modifié le ${format(p.editedAt)}.`, "");
    if (p.kind === "text")
      lines.push(
        ...(p.text ?? "").split(/\r?\n/).map((line) => `> ${markdown(line)}`),
        "",
      );
    else
      lines.push(
        `[${markdown(p.filename ?? "Fichier")}](${files
          .get(p.id)!
          .split("/")
          .map((segment) =>
            encodeURIComponent(segment).replace(
              /[!'()*]/g,
              (char) => "%" + char.charCodeAt(0).toString(16),
            ),
          )
          .join("/")}) · ${p.size} octets`,
        "",
      );
  }
  return { text: lines.join("\n"), files };
}

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let bit = 0; bit < 8; bit++) i = (i >>> 1) ^ (i & 1 ? 0xedb88320 : 0);
  return i >>> 0;
});
function crc32(data: Uint8Array, crc: number) {
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return crc;
}
function record(size: number, signature: number) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32LE(signature, 0);
  return bytes;
}

// ZIP STORE + data descriptors: bounded file reads, no temporary archive and no
// decompression of uploads. Layout follows PKWARE APPNOTE 4.3 (UTF-8 flag set).
export function sessionArchive(
  store: Store,
  sessionId: string,
  browserId: string,
) {
  store.actor(sessionId, browserId);
  const session = store.session(sessionId);
  const publications = store.publications(sessionId);
  const exported = discussion(session, publications, store.now());
  if (exported.files.size + 1 >= 65535)
    fail(413, "Trop de fichiers pour exporter cette session en ZIP.");
  const entries = [
    { name: "discussion.md", data: new Blob([exported.text]), id: "" },
    ...publications
      .filter((p) => p.kind === "file")
      .map((p) => ({
        name: exported.files.get(p.id)!,
        data: Bun.file(store.path(p.id)),
        id: p.id,
      })),
  ];
  const check = (id = "") => {
    store.actor(sessionId, browserId);
    if (
      id &&
      !store.db
        .query("SELECT id FROM publications WHERE id=? AND session_id=?")
        .get(id, sessionId)
    )
      throw new Error("Un fichier a été supprimé pendant l’export.");
  };
  async function* zip() {
    let offset = 0;
    const central: Buffer[] = [];
    for (const entry of entries) {
      check(entry.id);
      const name = Buffer.from(entry.name);
      const local = record(30, 0x04034b50);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0808, 6);
      local.writeUInt16LE(33, 12); // 1980-01-01, valid DOS date
      local.writeUInt16LE(name.length, 26);
      const start = offset;
      yield local;
      yield name;
      offset += local.length + name.length;
      let crc = 0xffffffff,
        size = 0;
      const reader = entry.data.stream().getReader();
      try {
        while (true) {
          check(entry.id);
          const chunk = await reader.read();
          check(entry.id);
          if (chunk.done) break;
          crc = crc32(chunk.value, crc);
          size += chunk.value.length;
          offset += chunk.value.length;
          if (offset >= 0xffffffff)
            throw new Error("Archive trop volumineuse.");
          yield chunk.value;
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
      const checksum = (crc ^ 0xffffffff) >>> 0;
      const descriptor = record(16, 0x08074b50);
      descriptor.writeUInt32LE(checksum, 4);
      descriptor.writeUInt32LE(size, 8);
      descriptor.writeUInt32LE(size, 12);
      yield descriptor;
      offset += descriptor.length;
      const header = record(46, 0x02014b50);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(0x0808, 8);
      header.writeUInt16LE(33, 14);
      header.writeUInt32LE(checksum, 16);
      header.writeUInt32LE(size, 20);
      header.writeUInt32LE(size, 24);
      header.writeUInt16LE(name.length, 28);
      header.writeUInt32LE(start, 42);
      central.push(Buffer.concat([header, name]));
    }
    check();
    const start = offset;
    for (const header of central) {
      yield header;
      offset += header.length;
    }
    const end = record(22, 0x06054b50);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(offset - start, 12);
    end.writeUInt32LE(start, 16);
    yield end;
  }
  const iterator = zip();
  let stopped = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          check();
          const next = await iterator.next();
          check();
          if (!stopped) {
            if (next.done) controller.close();
            else controller.enqueue(next.value);
          }
        } catch {
          await iterator.return(undefined);
          if (!stopped)
            controller.error(
              new Error(
                "Export interrompu. Vérifiez l’accès à la session et réessayez.",
              ),
            );
        }
      },
      async cancel() {
        stopped = true;
        await iterator.return(undefined);
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${session.slug}-archive.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
