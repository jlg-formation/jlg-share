import { useEffect, useRef, useState } from "react";

export function Screen({
  sessionId,
  admin,
}: {
  sessionId: string;
  admin: boolean;
}) {
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState(false),
    [hasVideo, setHasVideo] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    connection = useRef<{ stop: () => Promise<void> } | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void connection.current?.stop();
    };
  }, [sessionId]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const { openScreen } = await import("./media");
      const conn = await openScreen(
        sessionId,
        admin,
        (stream) => {
          if (!mounted.current) return;
          if (video.current) video.current.srcObject = stream;
          setHasVideo(!!stream);
        },
        (s) => {
          if (mounted.current) {
            setStatus(s);
            if (!s) setActive(false);
          }
        },
      );
      if (!mounted.current) {
        await conn.stop();
        return;
      }
      connection.current = conn;
      setActive(true);
    } catch (e) {
      setError((e as Error).message);
      setActive(false);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="screen-card">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
      <h3>L'écran du formateur</h3>
      <p>
        {admin
          ? "Montrez une fenêtre, un onglet ou votre écran au groupe."
          : "Regardez la démonstration du formateur, directement ici."}
      </p>
      <video
        className="screen-video"
        ref={video}
        autoPlay
        playsInline
        muted
        hidden={!hasVideo}
        aria-label="Écran partagé du formateur"
      />
      <p className="screen-status" role="status">
        {status}
      </p>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      {active ? (
        <button
          className="secondary"
          onClick={async () => {
            await connection.current?.stop();
            connection.current = null;
            setActive(false);
          }}
        >
          {admin ? "Arrêter le partage" : "Quitter le partage"}
        </button>
      ) : (
        <button className="secondary" disabled={busy} onClick={start}>
          {busy
            ? "Connexion…"
            : admin
              ? "Partager mon écran"
              : "Regarder le partage"}
        </button>
      )}
      {hasVideo && (
        <button
          className="quiet"
          onClick={() =>
            video.current
              ?.requestFullscreen()
              .catch(() =>
                setError("Le plein écran est indisponible dans ce navigateur."),
              )
          }
        >
          Afficher en plein écran
        </button>
      )}
    </section>
  );
}
