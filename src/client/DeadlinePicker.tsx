import { useEffect, useId, useRef, useState } from "react";
import {
  deadlineText,
  localDay,
  remainingTime,
  resolveDeadline,
  SESSION_TIMEZONE,
  zonedLocal,
  type DeadlineChoice,
} from "../shared/deadline";
import { serverNow } from "./api";

export function useNow() {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const update = () => setNow(serverNow());
    const timer = setInterval(update, 10_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

export function ExpiryText({
  expiresAt,
  timeZone = SESSION_TIMEZONE,
}: {
  expiresAt: number;
  timeZone?: string;
}) {
  const now = useNow();
  return <>Tout sera effacé {deadlineText(expiresAt, now, timeZone)}.</>;
}

export function DeadlinePicker({
  value,
  onChange,
  current,
  timeZone = SESSION_TIMEZONE,
  disabled = false,
  readOnly = false,
}: {
  value: DeadlineChoice | null;
  onChange: (value: DeadlineChoice) => void;
  current?: number;
  timeZone?: string;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  const now = useNow();
  const [open, setOpen] = useState(current === undefined);
  const [mode, setMode] = useState("");
  const [amount, setAmount] = useState("3");
  const [unit, setUnit] = useState<"minutes" | "hours" | "days">("days");
  const [exact, setExact] = useState("");
  const group = useRef<HTMLFieldSetElement>(null);
  const numberInput = useRef<HTMLInputElement>(null);
  const exactInput = useRef<HTMLInputElement>(null);
  const [focusGroup, setFocusGroup] = useState(false);
  const day = localDay(now, timeZone);
  // Refresh a visible calendar-day choice after midnight. An in-flight stale
  // choice is still rejected by the server rather than silently moving a day.
  useEffect(() => {
    if (
      value &&
      (value.kind === "tonight" || value.kind === "tomorrow") &&
      value.day !== day
    )
      onChange({ ...value, day });
  }, [day, value, onChange]);
  useEffect(() => {
    if (focusGroup && open) {
      group.current
        ?.querySelector<HTMLInputElement>(
          'input[type="radio"]:checked, input[type="radio"]',
        )
        ?.focus();
      setFocusGroup(false);
    }
  }, [open, focusGroup]);
  useEffect(() => {
    if (mode === "custom") numberInput.current?.focus();
    if (mode === "exact") exactInput.current?.focus();
  }, [mode]);
  const selected =
    mode === "custom" || mode === "exact"
      ? mode
      : value?.kind === "duration"
        ? value.amount === 7 && value.unit === "days"
          ? "week"
          : "day"
        : value?.kind;
  let preview: number | null = null,
    error = "";
  if (value) {
    try {
      preview = resolveDeadline(value, now, timeZone);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  function select(key: string) {
    setMode(key);
    if (key === "day")
      onChange({ kind: "duration", amount: 24, unit: "hours" });
    if (key === "week") onChange({ kind: "duration", amount: 7, unit: "days" });
    if (key === "tonight" || key === "tomorrow") onChange({ kind: key, day });
    if (key === "custom")
      onChange({
        kind: "duration",
        amount: amount === "" ? NaN : Number(amount),
        unit,
      });
  }
  return (
    <div className="deadline-picker">
      {current !== undefined && (
        <div className="deadline-current">
          <p>
            Temps restant :{" "}
            <strong>{remainingTime(current, now).replace(/^dans /, "")}</strong>
          </p>
          {!open && !readOnly && (
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              onClick={() => {
                setFocusGroup(true);
                setOpen(true);
              }}
            >
              Modifier
            </button>
          )}
        </div>
      )}
      {open && (
        <>
          <fieldset
            className="deadline-options"
            ref={group}
            disabled={disabled}
            aria-describedby={`${id}-help`}
          >
            <legend>Tout effacer…</legend>
            <div className="deadline-shortcuts">
              {[
                ["day", "Dans 24 h"],
                ["tonight", "Ce soir à minuit"],
                ["tomorrow", "Demain à minuit"],
                ["week", "Dans 7 jours"],
                ["custom", "Autre durée…"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className={
                    selected === key
                      ? "deadline-option selected"
                      : "deadline-option"
                  }
                >
                  <input
                    type="radio"
                    name={`${id}-choice`}
                    checked={selected === key}
                    tabIndex={
                      selected === key ||
                      ((!selected || selected === "exact") && key === "day")
                        ? 0
                        : -1
                    }
                    onChange={() => select(key)}
                    onKeyDown={(e) => {
                      const keys = [
                        "day",
                        "tonight",
                        "tomorrow",
                        "week",
                        "custom",
                      ];
                      const step = ["ArrowRight", "ArrowDown"].includes(e.key)
                        ? 1
                        : ["ArrowLeft", "ArrowUp"].includes(e.key)
                          ? -1
                          : 0;
                      if (!step && e.key !== "Home" && e.key !== "End") return;
                      e.preventDefault();
                      const next =
                        e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? 4
                            : (keys.indexOf(key) + step + keys.length) %
                              keys.length;
                      select(keys[next]);
                      group.current
                        ?.querySelectorAll<HTMLInputElement>(
                          'input[type="radio"]',
                        )
                        [next]?.focus();
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p id={`${id}-help`} className="hint">
            Minuit : fin de la journée choisie · {timeZone}
          </p>
          {selected === "tomorrow" && (
            <p className="hint">À la fin de demain.</p>
          )}
          {mode === "custom" && (
            <div className="deadline-custom">
              <label htmlFor={`${id}-amount`}>Dans</label>
              <input
                id={`${id}-amount`}
                ref={numberInput}
                type="number"
                min="1"
                step="1"
                required
                disabled={disabled}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  onChange({
                    kind: "duration",
                    amount:
                      e.target.value === "" ? NaN : Number(e.target.value),
                    unit,
                  });
                }}
              />
              <label className="sr-only" htmlFor={`${id}-unit`}>
                Unité de durée
              </label>
              <select
                id={`${id}-unit`}
                disabled={disabled}
                value={unit}
                onChange={(e) => {
                  const next = e.target.value as typeof unit;
                  setUnit(next);
                  onChange({
                    kind: "duration",
                    amount: amount === "" ? NaN : Number(amount),
                    unit: next,
                  });
                }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">heures</option>
                <option value="days">jours</option>
              </select>
            </div>
          )}
          <button
            type="button"
            className="quiet deadline-exact-link"
            disabled={disabled}
            aria-expanded={mode === "exact"}
            onClick={() => {
              // Merely opening the calendar keeps the current deadline unchanged.
              setExact(
                zonedLocal(
                  preview ?? current ?? now + 24 * 3_600_000,
                  timeZone,
                ),
              );
              setMode("exact");
            }}
          >
            Choisir une date précise
          </button>
          {mode === "exact" && (
            <div>
              <label htmlFor={`${id}-exact`}>Date et heure — {timeZone}</label>
              <input
                id={`${id}-exact`}
                ref={exactInput}
                type="datetime-local"
                required
                disabled={disabled}
                value={exact}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => {
                  setExact(e.target.value);
                  onChange({ kind: "exact", local: e.target.value });
                }}
              />
            </div>
          )}
          {error && (
            <p id={`${id}-error`} className="deadline-error" role="alert">
              {error}
            </p>
          )}
          {preview !== null && (
            <p className="deadline-preview">
              {current !== undefined ? "Après enregistrement : tout" : "Tout"}{" "}
              sera effacé {deadlineText(preview, now, timeZone)}.
              {mode === "exact" && value?.kind === "exact" && (
                <>
                  {" "}
                  {new Intl.DateTimeFormat("fr-FR", {
                    timeZone,
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(preview)}{" "}
                  · {timeZone}.
                </>
              )}
            </p>
          )}
          {value?.kind === "duration" && (
            <p className="hint">
              À partir de{" "}
              {current !== undefined ? "l'enregistrement" : "la création"}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
