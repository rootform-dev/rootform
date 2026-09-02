#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function exactKeys(value: JsonObject, expected: string[], label: string): void {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const canonical = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) {
    throw new Error(`${label} fields drifted: ${actual.join(", ")}`);
  }
}

export function validateTrivyPolicyBody(body: string, today = new Date()): void {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(body);
  } catch {
    throw new Error("Trivy policy is not valid YAML");
  }
  const policy = object(parsed, "Trivy policy");
  exactKeys(policy, ["vulnerabilities"], "Trivy policy");
  if (!Array.isArray(policy.vulnerabilities)) {
    throw new Error("Trivy vulnerability exceptions must be an array");
  }
  const normalizedToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  for (const [position, value] of policy.vulnerabilities.entries()) {
    const label = `Trivy vulnerability exception ${position + 1}`;
    const exception = object(value, label);
    exactKeys(exception, ["expired_at", "id", "paths", "statement"], label);
    if (
      typeof exception.id !== "string" ||
      !/^(?:CVE-[0-9]{4}-[0-9]{4,}|GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4})$/u.test(
        exception.id,
      )
    ) {
      throw new Error(`${label} has invalid vulnerability identity`);
    }
    if (
      !Array.isArray(exception.paths) ||
      exception.paths.length === 0 ||
      exception.paths.some(
        (path) =>
          typeof path !== "string" ||
          path.length === 0 ||
          path.startsWith("/") ||
          path.includes("..") ||
          path.includes("\\"),
      )
    ) {
      throw new Error(`${label} must name bounded image paths`);
    }
    if (
      typeof exception.statement !== "string" ||
      exception.statement.trim() !== exception.statement ||
      exception.statement.length < 20 ||
      exception.statement.length > 500
    ) {
      throw new Error(`${label} must include a concise justification`);
    }
    if (
      typeof exception.expired_at !== "string" ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(exception.expired_at)
    ) {
      throw new Error(`${label} must include an ISO expiration date`);
    }
    const expiration = new Date(`${exception.expired_at}T00:00:00Z`);
    if (Number.isNaN(expiration.valueOf()) || expiration <= normalizedToday) {
      throw new Error(`${label} is expired`);
    }
    const maximum = new Date(normalizedToday);
    maximum.setUTCDate(maximum.getUTCDate() + 90);
    if (expiration > maximum) {
      throw new Error(`${label} expires more than 90 days ahead`);
    }
  }
}

export function validateTrivyPolicy(root: string): void {
  validateTrivyPolicyBody(readFileSync(join(root, ".trivyignore.yaml"), "utf8"));
}

if (import.meta.main) {
  try {
    validateTrivyPolicy(join(import.meta.dir, ".."));
    console.log("Trivy exception policy is valid.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
