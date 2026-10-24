export const SESSION_TIMEZONE = "Europe/Paris";
export const HOUR = 3_600_000;
export type DeadlineChoice =
  | { kind: "duration"; amount: number; unit: "minutes" | "hours" | "days" }
  | { kind: "tonight" | "tomorrow"; day: string }
  | { kind: "exact"; local: string };

export function zonedLocal(value: number, timeZone = SESSION_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export const localDay = (value: number, timeZone = SESSION_TIMEZONE) =>
  zonedLocal(value, timeZone).slice(0, 10);

// Search the possible UTC offsets: reject nonexistent or ambiguous local times.
export function fromZonedLocal(local: string, timeZone = SESSION_TIMEZONE) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choisissez une date et une heure valides.");
  const base = Date.parse(local + "Z");
  if (!Number.isFinite(base))
    throw new Error("Choisissez une date et une heure valides.");
  const offsets = new Set<number>();
  for (const delta of [-2, -1, 0, 1, 2]) {
    const sample = base + delta * 24 * HOUR;
    offsets.add(Date.parse(zonedLocal(sample, timeZone) + "Z") - sample);
  }
  const matches = [...offsets]
    .map((offset) => base - offset)
    .filter((value) => zonedLocal(value, timeZone) === local);
  if (matches.length !== 1)
    throw new Error(
      "Cette heure est inexistante ou ambiguë lors du changement d'heure. Choisissez une autre heure.",
    );
  return matches[0];
}

export function resolveDeadline(
  value: unknown,
  now: number,
  timeZone = SESSION_TIMEZONE,
): number {
  if (!value || typeof value !== "object")
    throw new Error("Choisissez quand tout effacer.");
  const choice = value as DeadlineChoice;
  let result: number;
  if (choice.kind === "duration") {
    const unit = { minutes: 60_000, hours: HOUR, days: 24 * HOUR }[choice.unit];
    if (!unit || !Number.isSafeInteger(choice.amount) || choice.amount <= 0)
      throw new Error("Saisissez une durée entière strictement positive.");
    result = now + choice.amount * unit;
  } else if (choice.kind === "tonight" || choice.kind === "tomorrow") {
    if (choice.day !== localDay(now, timeZone))
      throw new Error(
        "Le jour a changé. Sélectionnez à nouveau la fin de journée souhaitée.",
      );
    const day = new Date(choice.day + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + (choice.kind === "tonight" ? 1 : 2));
    result = fromZonedLocal(
      day.toISOString().slice(0, 10) + "T00:00",
      timeZone,
    );
  } else if (choice.kind === "exact") {
    if (typeof choice.local !== "string")
      throw new Error("Choisissez une date et une heure valides.");
    result = fromZonedLocal(choice.local, timeZone);
  } else throw new Error("Choisissez quand tout effacer.");
  if (
    !Number.isSafeInteger(result) ||
    result > 8_640_000_000_000_000 ||
    result <= now
  )
    throw new Error(
      "Choisissez une échéance future valide ; la durée est peut-être trop grande.",
    );
  return result;
}

export function remainingTime(expiresAt: number, now: number) {
  const diff = expiresAt - now;
  if (diff <= 0) return "à présent";
  if (diff < 60_000) return "dans moins d'une minute";
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) {
    const days = Math.floor(hours / 24),
      rest = hours % 24;
    return `dans ${days} jours${rest ? ` et ${rest} h` : ""}`;
  }
  return hours
    ? `dans ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `dans ${minutes} min`;
}

export function deadlineText(
  expiresAt: number,
  now: number,
  timeZone = SESSION_TIMEZONE,
) {
  const relative = remainingTime(expiresAt, now);
  if (expiresAt <= now || zonedLocal(expiresAt, timeZone).slice(11) !== "00:00")
    return relative;
  const day = localDay(now, timeZone);
  for (const kind of ["tonight", "tomorrow"] as const) {
    if (resolveDeadline({ kind, day }, now, timeZone) === expiresAt)
      return `${kind === "tonight" ? "ce soir" : "demain"} à minuit — ${relative}`;
  }
  return relative;
}
