import { test, expect } from "bun:test";
import { allowsOrigin } from "../src/server/origin";

test("local development accepts only loopback aliases on the configured port", () => {
  const config = { origin: "http://localhost:5173", secure: false };
  expect(allowsOrigin("http://localhost:5173", config)).toBe(true);
  expect(allowsOrigin("http://127.0.0.1:5173", config)).toBe(true);
  expect(allowsOrigin("http://[::1]:5173", config)).toBe(true);
  for (const origin of [
    null,
    "null",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://localhost.evil.test:5173",
    "http://evil.test:5173",
    "https://localhost:5173",
    "http://localhost:5173/",
  ]) {
    expect(allowsOrigin(origin, config)).toBe(false);
  }
});
test("production keeps exact origin validation", () => {
  const config = { origin: "https://share.jlg-consulting.com", secure: true };
  expect(allowsOrigin(config.origin, config)).toBe(true);
  expect(allowsOrigin("http://127.0.0.1:5173", config)).toBe(false);
  expect(allowsOrigin("https://other.jlg-consulting.com", config)).toBe(false);
  expect(
    allowsOrigin("http://localhost:5173", {
      origin: "http://127.0.0.1:5173",
      secure: true,
    }),
  ).toBe(false);
});
