import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session, Snapshot, Publication } from "../shared/types";
import { FILE_LIMIT } from "../shared/types";
import { api, ApiError, bytes, date, localDate, upload } from "./api";
import "./style.css";
import { Screen } from "./Screen";

type Me = { admin: boolean; name: string };
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    file: (
      <>
        <path d="M14 3H6v18h12V7zM14 3v5h4M9 13h6M9 17h6" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    send: <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.file}
    </svg>
  );
}
function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-icon">j.</span>
      <span>
        JLG <strong>Share</strong>
      </span>
    </a>
  );
}
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}
function App() {
  const [me, setMe] = useState<Me | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Me>("/me")
      .then(setMe)
      .catch((e) => setError(e.message));
  }, []);
  const match = location.pathname.match(/^\/s\/([a-zA-Z0-9-]+)$/);
  if (error)
    return (
      <main className="gate">
        <Brand />
        <Notice>{error}</Notice>
        <button onClick={() => location.reload()}>Réessayer</button>
      </main>
    );
  if (!me)
    return (
      <main className="gate">
        <Brand />
        <p role="status">Ouverture de votre espace…</p>
      </main>
    );
  return match ? (
    <Room id={match[1]} me={me} />
  ) : (
    <Home me={me} setMe={setMe} />
  );
}
function Home({ me, setMe }: { me: Me; setMe: (me: Me) => void }) {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sessions, setSessions] = useState<Session[]>([]),
    [title, setTitle] = useState(""),
    [expires, setExpires] = useState(""),
    [code, setCode] = useState(""),
    [name, setName] = useState(me.name);
  async function refresh() {
    try {
      setSessions(await api("/sessions"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (me.admin) void refresh();
  }, [me.admin]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", "POST", { password });
      setPassword("");
      setMe(await api("/me"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await api<Session>("/sessions", "POST", {
        title,
        expiresAt: new Date(expires).getTime(),
        code,
      });
      location.assign("/s/" + s.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <header className="topbar">
        <Brand />
        <span className="top-caption">L'espace de votre formation</span>
        {me.admin && (
          <button
            className="quiet"
            onClick={async () => {
              await api("/logout", "POST");
              setMe(await api("/me"));
            }}
          >
            Se déconnecter
          </button>
        )}
      </header>
      <main className="home">
        <div className="hero">
          <span className="eyebrow">PARTAGER, TOUT SIMPLEMENT</span>
          <h1>
            Tout le groupe.
            <br />
            <span>Au même endroit.</span>
          </h1>
          <p>
            Un lien pour échanger des idées, des ressources
            <br className="desktop" /> et des fichiers pendant votre formation.
          </p>
        </div>
        {error && <Notice>{error}</Notice>}
        {!me.admin ? (
          <div className="home-grid">
            <section className="card login">
              <span className="eyebrow">ESPACE FORMATEUR</span>
              <h2>Bienvenue chez vous.</h2>
              <p className="muted">
                Connectez-vous pour créer et gérer vos sessions.
              </p>
              <form onSubmit={login}>
                <label htmlFor="password">Mot de passe administrateur</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="primary" disabled={busy}>
                  {busy ? "Connexion…" : "Ouvrir mon espace"}
                  <Icon name="arrow" />
                </button>
              </form>
            </section>
            <section className="welcome-note">
              <span className="note-number">01 / UN ESPACE COMMUN</span>
              <h2>
                Moins de pièces jointes.
                <br />
                Plus de partage.
              </h2>
              <p>
                Textes, liens et fichiers restent réunis dans le fil de votre
                session. Rien à installer, aucun compte à créer pour les
                stagiaires.
              </p>
              <div className="note-tags">
                <span>Chat en direct</span>
                <span>Fichiers jusqu'à 50 Mo</span>
                <span>Ressources temporaires</span>
              </div>
              <p className="small muted">
                Vous êtes stagiaire ? Utilisez le lien transmis par votre
                formateur.
              </p>
            </section>
          </div>
        ) : (
          <>
            <div className="home-grid">
              <section className="card">
                <span className="eyebrow">UNE NOUVELLE FORMATION</span>
                <h2>Créer une session</h2>
                <form onSubmit={create}>
                  <label htmlFor="title">Titre de la session</label>
                  <input
                    id="title"
                    required
                    maxLength={120}
                    placeholder="Ex. Excel — les fondamentaux"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <label htmlFor="expires">Tout effacer le</label>
                  <input
                    id="expires"
                    type="datetime-local"
                    required
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
                  <p className="hint">
                    Heure de votre appareil (
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}). Chats
                    et fichiers seront supprimés à cette échéance.
                  </p>
                  <label htmlFor="code">
                    Code d'accès <span className="muted">· facultatif</span>
                  </label>
                  <input
                    id="code"
                    maxLength={128}
                    autoComplete="off"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button className="primary" disabled={busy}>
                    <Icon name="plus" />
                    {busy ? "Création…" : "Créer et ouvrir la session"}
                  </button>
                </form>
              </section>
              <section>
                <div className="section-title">
                  <h2>Vos sessions</h2>
                  <span className="pill">{sessions.length}</span>
                </div>
                <p className="muted">
                  Retrouvez les groupes dont les ressources sont encore
                  disponibles.
                </p>
                {sessions.length === 0 ? (
                  <div className="empty-list">
                    <Icon name="file" />
                    <p>Votre première session commence ici.</p>
                  </div>
                ) : (
                  sessions.map((s) => (
                    <a className="session-card" key={s.id} href={"/s/" + s.id}>
                      <div>
                        <h3>{s.title}</h3>
                        <p>Suppression le {date(s.expiresAt)}</p>
                        <span className="small">
                          {s.closed
                            ? "Fermée"
                            : s.protected
                              ? "Accès avec code"
                              : "Accès par lien"}{" "}
                          · {bytes(s.usedBytes)}
                        </span>
                      </div>
                      <Icon name="arrow" />
                    </a>
                  ))
                )}
                <form
                  className="profile"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError("");
                    try {
                      await api("/settings", "PATCH", { name });
                      setMe({ ...me, name });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <label htmlFor="admin-name">
                    Votre nom dans les échanges{" "}
                    <span className="muted">(admin)</span>
                  </label>
                  <div className="inline">
                    <input
                      id="admin-name"
                      value={name}
                      required
                      maxLength={40}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <button className="secondary">Enregistrer</button>
                  </div>
                </form>
              </section>
            </div>
          </>
        )}
      </main>
      <footer>
        JLG Share <span>Un espace temporaire. Des échanges utiles.</span>
      </footer>
    </>
  );
}
function LinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s<>]+)/gi).map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
function Room({ id, me }: { id: string; me: Me }) {
  const base = "/sessions/" + id;
  const [intro, setIntro] = useState<{
      title: string;
      expiresAt: number;
      protected: boolean;
      closed: boolean;
    } | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState(""),
    [nickname, setNickname] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState(""),
    [progress, setProgress] = useState<{
      name: string;
      percent: number;
    } | null>(null),
    [connected, setConnected] = useState(false),
    [manage, setManage] = useState(false),
    [deadline, setDeadline] = useState(""),
    [toast, setToast] = useState(""),
    [drag, setDrag] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    end = useRef<HTMLDivElement>(null),
    form = useRef<HTMLFormElement>(null),
    sent = useRef(false);
  function handle(e: unknown) {
    const err = e as ApiError;
    if (err.status === 404 || err.status === 410) {
      setFatal(err.message);
      setSnapshot(null);
    } else if (err.status === 401 || err.status === 403) {
      setSnapshot(null);
      setError(err.message);
    } else setError(err.message);
  }
  async function refresh() {
    try {
      const data = await api<Snapshot>(base + "/snapshot");
      setSnapshot(data);
      setIntro(data.session);
      return data;
    } catch (e) {
      handle(e);
    }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await api(base);
        if (cancelled) return;
        setIntro(info);
        try {
          const state = await api<Snapshot>(base + "/snapshot");
          if (!cancelled) setSnapshot(state);
        } catch (e) {
          if (me.admin) {
            await api(base + "/join", "POST", {});
            if (!cancelled) await refresh();
          } else if ((e as ApiError).status !== 403) throw e;
        }
      } catch (e) {
        if (!cancelled) handle(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (!snapshot) return;
    let disposed = false;
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?session=${id}`,
      );
      socket.onopen = () => {
        setConnected(true);
        void refresh();
      };
      socket.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === "expired") {
          setSnapshot(null);
          setFatal("Cette session a été supprimée.");
        } else void refresh();
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    const poll = setInterval(() => {
      void refresh();
      if (socket.readyState === WebSocket.OPEN) socket.send("ping");
    }, 20_000);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(poll);
      socket?.close();
    };
  }, [!!snapshot, id]);
  useEffect(() => {
    if (sent.current) {
      end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      sent.current = false;
    }
  }, [snapshot?.publications.length]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(
      () => {
        void refresh();
      },
      Math.max(0, Math.min(2_147_000_000, intro.expiresAt - Date.now() + 50)),
    );
    return () => clearTimeout(t);
  }, [intro?.expiresAt]);
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(base + "/join", "POST", { nickname, code });
      await refresh();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(base + "/messages", "POST", { text: draft });
      setDraft("");
      sent.current = true;
      await refresh();
    } catch (e) {
      handle(e);
    } finally {
      setBusy(false);
    }
  }
  async function files(list: FileList | File[] | null) {
    if (!list || progress) return;
    setError("");
    for (const file of Array.from(list)) {
      if (file.size < 1 || file.size > FILE_LIMIT) {
        setError("Chaque fichier doit contenir entre 1 octet et 50 Mo.");
        break;
      }
      setProgress({ name: file.name, percent: 0 });
      try {
        await upload(base + "/files", file, (percent) =>
          setProgress({ name: file.name, percent }),
        );
        sent.current = true;
        await refresh();
      } catch (e) {
        handle(e);
        break;
      } finally {
        setProgress(null);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  async function remove(p: Publication) {
    if (
      !confirm(
        p.kind === "file"
          ? "Supprimer ce fichier pour tout le groupe ?"
          : "Supprimer ce message pour tout le groupe ?",
      )
    )
      return;
    try {
      await api(base + "/messages/" + p.id, "DELETE");
      await refresh();
    } catch (e) {
      handle(e);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Copié dans le presse-papiers");
    } catch {
      setError(
        "La copie automatique est indisponible. Sélectionnez le texte pour le copier.",
      );
    }
  }
  if (fatal)
    return (
      <main className="gate">
        <Brand />
        <div className="card">
          <span className="eyebrow">ESPACE TEMPORAIRE</span>
          <h1>Cette session est terminée.</h1>
          <p>{fatal}</p>
          <a className="button primary" href="/">
            Revenir à l'accueil
          </a>
        </div>
      </main>
    );
  if (!snapshot)
    return (
      <>
        <header className="topbar">
          <Brand />
          <span className="top-caption">Bienvenue dans votre formation</span>
        </header>
        <main className="gate">
          <section className="card join-card">
            <span className="eyebrow">REJOINDRE LE GROUPE</span>
            <h1>{intro?.title ?? "Ouverture de la session…"}</h1>
            {error && <Notice>{error}</Notice>}
            {intro && (
              <form onSubmit={join}>
                <p className="muted">
                  Un prénom, des initiales ou un pseudo : choisissez le nom qui
                  accompagnera vos échanges.
                </p>
                <label htmlFor="nickname">Votre pseudo</label>
                <input
                  autoFocus
                  id="nickname"
                  required
                  maxLength={40}
                  autoComplete="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
                {intro.protected && (
                  <>
                    <label htmlFor="join-code">Code d'accès</label>
                    <input
                      id="join-code"
                      type="password"
                      autoComplete="off"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </>
                )}
                <button className="primary" disabled={busy || intro.closed}>
                  {intro.closed
                    ? "Session fermée"
                    : busy
                      ? "Connexion…"
                      : "Rejoindre la session"}
                  <Icon name="arrow" />
                </button>
                <p className="hint">
                  Tout sera effacé le {date(intro.expiresAt)}.
                </p>
              </form>
            )}
          </section>
        </main>
      </>
    );
  const { session, publications, participants } = snapshot;
  const admin = snapshot.me.admin;
  const sharedFiles = publications.filter((p) => p.kind === "file");
  return (
    <div
      className="room-layout"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void files(e.dataTransfer.files);
      }}
    >
      <header className="topbar">
        <Brand />
        <div className="room-title">
          <strong>{session.title}</strong>
          <span className="connection">
            <i className={connected ? "online" : ""} />
            {connected ? "En direct" : "Reconnexion…"}
          </span>
        </div>
        <span className="identity">
          {snapshot.me.nickname}
          {admin ? " (admin)" : ""}
        </span>
      </header>
      <div className="room-heading">
        <div>
          <span className="eyebrow">VOTRE ESPACE COMMUN</span>
          <h1>{session.title}</h1>
          <p className="muted">
            Échangez un texte, un lien, un fichier. Tout le groupe en profite.
          </p>
        </div>
        <div className="room-actions">
          <button
            className="secondary"
            onClick={() => copy(location.origin + "/s/" + id)}
          >
            <Icon name="copy" />
            Copier le lien
          </button>
          {admin && (
            <button
              className="secondary"
              onClick={() => {
                setDeadline(localDate(session.expiresAt));
                setManage(!manage);
              }}
            >
              Gérer la session
            </button>
          )}
        </div>
      </div>
      <div className="expiry-bar">
        <span>
          <Icon name="lock" />
          Effacement automatique le <strong>{date(session.expiresAt)}</strong>
        </span>
        <span>
          {participants.length} participant{participants.length > 1 ? "s" : ""}
        </span>
      </div>
      {manage && admin && (
        <section className="manage card">
          <h2>Réglages de la session</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(base, "PATCH", {
                  expiresAt: new Date(deadline).getTime(),
                });
                await refresh();
                setManage(false);
              } catch (e) {
                handle(e);
              }
            }}
          >
            <label htmlFor="new-deadline">
              Nouvelle date de suppression —{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </label>
            <div className="inline">
              <input
                id="new-deadline"
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <button className="primary">Enregistrer</button>
            </div>
          </form>
          <div className="inline">
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api(base, "PATCH", { closed: !session.closed });
                  await refresh();
                } catch (e) {
                  handle(e);
                }
              }}
            >
              {session.closed
                ? "Rouvrir aux stagiaires"
                : "Fermer aux stagiaires"}
            </button>
            <button
              className="danger"
              onClick={async () => {
                if (
                  confirm(
                    "Supprimer définitivement cette session, tous ses messages et fichiers ?",
                  )
                )
                  try {
                    await api(base, "DELETE");
                    location.assign("/");
                  } catch (e) {
                    handle(e);
                  }
              }}
            >
              Supprimer maintenant
            </button>
          </div>
        </section>
      )}
      {session.closed && <Notice>La session est fermée aux stagiaires.</Notice>}
      {error && (
        <div className="inline error-row">
          <Notice>{error}</Notice>
          <button
            className="quiet"
            aria-label="Fermer le message"
            onClick={() => setError("")}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="workspace">
        <section className="chat-panel" aria-label="Chat commun">
          <div className="panel-heading">
            <h2>Le fil de la session</h2>
            <span className="small muted">Textes, liens & fichiers</span>
          </div>
          <div
            className="messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {publications.length === 0 ? (
              <div className="empty-chat">
                <span className="empty-symbol">↗</span>
                <h2>La conversation commence ici.</h2>
                <p>
                  Envoyez votre premier message ou déposez un fichier.
                  <br />
                  Il sera visible par tous les participants.
                </p>
              </div>
            ) : (
              publications.map((p) => (
                <article
                  className={
                    "message " +
                    (p.participantId === snapshot.me.id ? "own" : "")
                  }
                  key={p.id}
                >
                  <div className="avatar">
                    {p.nickname.slice(0, 2).toLocaleUpperCase()}
                  </div>
                  <div className="message-content">
                    <div className="message-meta">
                      <strong>
                        {p.nickname}
                        {p.admin && (
                          <span className="admin-label"> (admin)</span>
                        )}
                      </strong>
                      <time dateTime={new Date(p.createdAt).toISOString()}>
                        {new Intl.DateTimeFormat("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(p.createdAt)}
                        {p.editedAt ? " · modifié" : ""}
                      </time>
                    </div>
                    {editing === p.id ? (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await api(base + "/messages/" + p.id, "PATCH", {
                              text: editText,
                            });
                            setEditing(null);
                            await refresh();
                          } catch (e) {
                            handle(e);
                          }
                        }}
                      >
                        <textarea
                          aria-label="Modifier le message"
                          required
                          maxLength={20_000}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <div className="inline">
                          <button className="secondary">Enregistrer</button>
                          <button
                            type="button"
                            className="quiet"
                            onClick={() => setEditing(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </form>
                    ) : p.kind === "file" ? (
                      <a
                        className="file-bubble"
                        href={"/api" + base + "/files/" + p.id}
                        download
                      >
                        <span className="file-icon">
                          <Icon name="file" />
                        </span>
                        <div>
                          <strong>{p.filename}</strong>
                          <span>{bytes(p.size)} · Télécharger</span>
                        </div>
                        <Icon name="download" />
                      </a>
                    ) : (
                      <div className="message-text">
                        <LinkedText text={p.text ?? ""} />
                      </div>
                    )}
                    <div className="message-actions">
                      {p.kind === "text" && (
                        <button onClick={() => copy(p.text ?? "")}>
                          Copier
                        </button>
                      )}
                      {p.kind === "text" &&
                        p.participantId === snapshot.me.id && (
                          <button
                            onClick={() => {
                              setEditing(p.id);
                              setEditText(p.text ?? "");
                            }}
                          >
                            Modifier
                          </button>
                        )}
                      {(admin || p.participantId === snapshot.me.id) && (
                        <button onClick={() => remove(p)}>Supprimer</button>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
            <div ref={end} />
          </div>
          <div className="composer-wrap">
            {progress && (
              <div className="upload-progress" role="status">
                <span>
                  {progress.name} · {progress.percent}%
                  {progress.percent === 100 ? " · validation…" : ""}
                </span>
                <progress max="100" value={progress.percent} />
              </div>
            )}
            <form className="composer" onSubmit={send} ref={form}>
              <textarea
                aria-label="Votre message"
                placeholder="Un message, un lien, une idée…"
                maxLength={20_000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    form.current?.requestSubmit();
                  }
                }}
              />
              <div className="composer-bottom">
                <input
                  ref={fileInput}
                  className="sr-only"
                  aria-label="Choisir des fichiers"
                  type="file"
                  multiple
                  onChange={(e) => files(e.target.files)}
                />
                <button
                  type="button"
                  className="quiet attach"
                  disabled={!!progress}
                  onClick={() => fileInput.current?.click()}
                >
                  <Icon name="plus" />
                  Joindre un fichier
                </button>
                <span className="hint keyboard">
                  Entrée pour envoyer · Maj + Entrée pour une ligne
                </span>
                <button
                  className="send"
                  aria-label="Envoyer le message"
                  disabled={busy || !draft.trim()}
                >
                  <Icon name="send" />
                </button>
              </div>
            </form>
            <p className="composer-hint">
              Visible par tout le groupe · 50 Mo maximum par fichier
            </p>
          </div>
        </section>
        <aside className="resources">
          <section className="card resource-card">
            <span className="eyebrow">À PORTÉE DE MAIN</span>
            <div className="section-title">
              <h2>Les fichiers</h2>
              <span className="pill">{sharedFiles.length}</span>
            </div>
            <p className="muted small">
              Toutes les ressources du groupe, sans remonter le fil.
            </p>
            <div className="quota">
              <span
                style={{
                  width:
                    Math.min(100, (session.usedBytes / 1_000_000_000) * 100) +
                    "%",
                }}
              />
            </div>
            <p className="small muted">
              {bytes(session.usedBytes)} utilisés sur 1 Go
            </p>
            <div className="file-list">
              {sharedFiles.length === 0 ? (
                <p className="empty-files">
                  Les fichiers partagés apparaîtront ici.
                </p>
              ) : (
                sharedFiles.map((p) => (
                  <a
                    key={p.id}
                    href={"/api" + base + "/files/" + p.id}
                    download
                  >
                    <Icon name="file" />
                    <div>
                      <strong>{p.filename}</strong>
                      <span>
                        {p.nickname} · {bytes(p.size)}
                      </span>
                    </div>
                    <Icon name="download" />
                  </a>
                ))
              )}
            </div>
            <button
              className="secondary full"
              disabled={!!progress}
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="plus" />
              Partager un fichier
            </button>
          </section>
          <Screen sessionId={id} admin={admin} />
          <div className="participants-note">
            <strong>Dans cette session</strong>
            <p>
              {participants
                .map((p) => p.nickname + (p.admin ? " (admin)" : ""))
                .join(", ")}
            </p>
          </div>
        </aside>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {drag && (
        <div className="drop-overlay">
          <Icon name="file" />
          <h2>Déposez vos fichiers ici</h2>
          <p>Ils seront partagés avec toute la session.</p>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
