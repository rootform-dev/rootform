import { expect, test } from "bun:test";
import { validateTrivyPolicyBody } from "./validate-trivy-policy.ts";

const today = new Date("2026-09-02T12:00:00Z");

test("accepts no vulnerability exceptions", () => {
  expect(() => validateTrivyPolicyBody("vulnerabilities: []\n", today)).not.toThrow();
});

test("accepts a justified scoped exception expiring within 90 days", () => {
  expect(() =>
    validateTrivyPolicyBody(
      `vulnerabilities:
  - id: CVE-2026-12345
    paths:
      - usr/lib/example.so
    statement: Upstream fix is unavailable; compensating control blocks the affected path.
    expired_at: 2026-10-01
`,
      today,
    ),
  ).not.toThrow();
});

test("rejects undocumented, unscoped, expired, long-lived, and expanded exceptions", () => {
  for (const body of [
    `vulnerabilities:
  - id: CVE-2026-12345
    paths: [usr/lib/example.so]
    statement: too short
    expired_at: 2026-10-01
`,
    `vulnerabilities:
  - id: CVE-2026-12345
    paths: []
    statement: Upstream fix is unavailable and exposure is bounded.
    expired_at: 2026-10-01
`,
    `vulnerabilities:
  - id: CVE-2026-12345
    paths: [usr/lib/example.so]
    statement: Upstream fix is unavailable and exposure is bounded.
    expired_at: 2026-09-02
`,
    `vulnerabilities:
  - id: CVE-2026-12345
    paths: [usr/lib/example.so]
    statement: Upstream fix is unavailable and exposure is bounded.
    expired_at: 2027-01-01
`,
    `vulnerabilities:
  - id: CVE-2026-12345
    paths: [usr/lib/example.so]
    statement: Upstream fix is unavailable and exposure is bounded.
    expired_at: 2026-10-01
    owner: example
`,
  ]) {
    expect(() => validateTrivyPolicyBody(body, today)).toThrow();
  }
});
