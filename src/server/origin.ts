export function allowsOrigin(
  received: string | null,
  config: { origin: string; secure: boolean },
): boolean {
  if (received === config.origin) return true;
  if (!received || config.secure) return false;
  try {
    const expected = new URL(config.origin);
    const actual = new URL(received);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (
      expected.protocol === "http:" &&
      actual.protocol === "http:" &&
      loopback.has(expected.hostname) &&
      loopback.has(actual.hostname) &&
      expected.port === actual.port &&
      actual.origin === received
    );
  } catch {
    return false;
  }
}
