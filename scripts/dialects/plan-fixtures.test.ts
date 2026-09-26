import { expect, test } from "bun:test";
import { offlineConfiguration } from "./offline-providers.ts";
import {
  configuredProviders,
  exactVersion,
  providerRequirements,
  rulesWithFacts,
} from "./plan-fixtures.ts";
import { scenarioAddress, scenarioProblems, sentinelProblems } from "./scenario-checks.ts";

const source = `terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
    google = {
      source  = "registry.terraform.io/hashicorp/google"
      version = "8.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0.0, < 4.0.0"
    }
  }
}

provider "google" {
  access_token = "fixture"
}
`;

test("provider requirements read inline and multi-line entries", () => {
  expect(providerRequirements(source)).toEqual([
    { local: "azurerm", source: "hashicorp/azurerm", version: "= 5.3.0" },
    { local: "google", source: "hashicorp/google", version: "8.0.0" },
    { local: "random", source: "hashicorp/random", version: ">= 3.0.0, < 4.0.0" },
  ]);
});

test("a fixture pins every provider to one release", () => {
  const [azurerm, google, random] = providerRequirements(source);
  expect(azurerm && exactVersion(azurerm)).toBe("5.3.0");
  expect(google && exactVersion(google)).toBe("8.0.0");
  expect(() => random && exactVersion(random)).toThrow("must pin one exact version");
});

test("offline configuration leaves providers the fixture configures itself", () => {
  const configuration = offlineConfiguration(
    providerRequirements(source),
    configuredProviders(source),
  );
  expect(configuration).toContain('provider "azurerm" {');
  expect(configuration).toContain("features {}");
  expect(configuration).toContain('provider "random" {');
  expect(configuration).not.toContain('provider "google"');
  expect(() =>
    offlineConfiguration([{ local: "x", source: "example/unknown", version: "1.0.0" }], new Set()),
  ).toThrow("no offline profile for provider example/unknown");
});

const golden = JSON.stringify({
  default_stage: "planned",
  stages: {
    planned: {
      representations: [
        {
          id: "representation:1:a_client.portal",
          address: "a_client.portal",
          rule: "a.rule.client",
          provider: { address: "registry.terraform.io/a/a" },
          interpretation: { status: "applied" },
        },
        {
          id: "representation:1:a_org.customer",
          address: "a_org.customer",
          provider: { address: "registry.terraform.io/a/a" },
          interpretation: { status: "none" },
        },
      ],
      relations: [
        {
          from: "representation:1:a_client.portal",
          to: "representation:1:a_org.customer",
          predicate: "a.relation.defaults-to-organization",
          provenance: [{ rule: "a.rule.client" }],
        },
      ],
      contexts: [],
      contributions: [],
    },
  },
});

test("scenario endpoints name configuration addresses", () => {
  expect(scenarioAddress("representation:1:root:resource:a_client.portal")).toBe("a_client.portal");
  expect(scenarioAddress("representation:1:root:data:a_org.customer")).toBe("data.a_org.customer");
});

test("scenario expectations are checked against the default stage", () => {
  const relation = {
    collection: "relations" as const,
    from: "representation:1:root:resource:a_client.portal",
    to: "representation:1:root:resource:a_org.customer",
    type: "defaults-to-organization",
    rule: "a.rule.client",
  };
  expect(
    scenarioProblems(
      {
        id: "met",
        fixture: "fixtures/a/minimal",
        required_rules: ["a.rule.client"],
        required_outcomes: {
          "a_client.portal": "representation-present",
          "a_org.customer": "no-rule",
        },
        required_facts: [relation],
        minimum: { representations: 2, relations: 1 },
        maximum_facts: { contexts: 0 },
        forbid_cross_provider_facts: true,
      },
      golden,
    ),
  ).toEqual([]);
  expect(
    scenarioProblems(
      {
        id: "unmet",
        fixture: "fixtures/a/minimal",
        required_rules: ["a.rule.org"],
        required_outcomes: {
          "a_client.portal": "no-rule",
          "a_client.missing": "representation-present",
        },
        required_facts: [{ ...relation, rule: "a.rule.org" }],
        maximum_facts: { relations: 0 },
      },
      golden,
    ),
  ).toEqual([
    "unmet: rule a.rule.org applies to no instance",
    "unmet: a_client.portal is interpreted, expected no rule",
    "unmet: a_client.missing is absent",
    "unmet: missing defaults-to-organization a_client.portal -> a_org.customer from a.rule.org",
    "unmet: relations: 1, expected at most 0",
  ]);
});

test("rules with facts come from fact provenance at every stage", () => {
  expect([...rulesWithFacts(golden)]).toEqual(["a.rule.client"]);
});

test("a forbidden payload must reach the input and no output", () => {
  expect(sentinelProblems("f", ["SECRET"], ['x = "SECRET"'], ["{}"])).toEqual([]);
  expect(sentinelProblems("f", ["SECRET"], ["x"], ["SECRET"])).toEqual([
    "f: forbidden payload SECRET is absent from the input",
    "f: forbidden payload SECRET reached an output",
  ]);
});
