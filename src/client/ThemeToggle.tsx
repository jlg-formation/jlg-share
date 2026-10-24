import { useEffect, useRef, useState } from "react";
type Theme = "light" | "dark";
const key = "jlg-share-theme";
function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(key);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#121b17" : "#f6f7f3");
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const explicit = useRef(savedTheme());
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const next = explicit.current ?? (media.matches ? "dark" : "light");
      applyTheme(next);
      setTheme(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        explicit.current = savedTheme();
        sync();
      }
    };
    media.addEventListener("change", sync);
    window.addEventListener("storage", storage);
    sync();
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const label =
    theme === "dark" ? "Passer au mode clair" : "Passer au mode sombre";
  return (
    <button
      type="button"
      className="theme-toggle secondary"
      title={label}
      aria-label={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        explicit.current = next;
        try {
          localStorage.setItem(key, next);
        } catch {}
        applyTheme(next);
        setTheme(next);
      }}
    >
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
        )}
      </svg>
    </button>
  );
}
