import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type PublicationAction = {
  label: string;
  run?: () => void;
  href?: string;
  danger?: boolean;
};
export function PublicationMenu({
  label,
  actions,
}: {
  label: string;
  actions: PublicationAction[];
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ top: 0, left: 0 });
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  function close(focus = false) {
    setOpen(false);
    if (focus) button.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const rect = button.current.getBoundingClientRect(),
      height = menu.current.getBoundingClientRect().height,
      width = menu.current.getBoundingClientRect().width;
    setPosition({
      left: Math.max(8, Math.min(rect.right - width, innerWidth - width - 8)),
      top:
        rect.bottom + height + 4 <= innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - height - 4),
    });
    menu.current.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !button.current?.contains(event.target as Node)
      )
        close();
    };
    const reposition = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === "Tab") {
        close(true);
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = Array.from(
        menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : event.key === "ArrowDown"
              ? (current + 1) % items.length
              : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="publication-menu-trigger"
        aria-label={label}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            className="publication-menu"
            role="menu"
            aria-label={label}
            style={position}
          >
            {actions.map((action) =>
              action.href ? (
                <a
                  key={action.label}
                  role="menuitem"
                  tabIndex={-1}
                  href={action.href}
                  download
                  onClick={() => close(true)}
                >
                  {action.label}
                </a>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={action.danger ? "menu-danger" : ""}
                  onClick={() => {
                    close(true);
                    action.run?.();
                  }}
                >
                  {action.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
