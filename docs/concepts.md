---
title: "Core concepts"
description: "Understand how plan and state evidence becomes architecture, comparison, and policy results."
---

Rootform reads Terraform or OpenTofu plan JSON or state JSON. It does not run the producer, evaluate configuration source, or query a cloud account. A [Dialect](concepts/dialects.md) maps observed resource instances to architectural meaning through Rules. The result is a format-1 [architecture document](concepts/architecture-ir.md).

A Rule can classify an instance with a Concept and emit Context, Relation, or Contribution facts. A resource with no applicable Rule still appears as a representation without a guessed Concept. A source dependency or similar attribute is evidence; only a Dialect emission makes it an architectural claim.

Every emission has a closure for each applicable instance. `resolved` records proven facts, `absent` records declared absence, and `indeterminate` preserves unknown, sensitive, conflicting, or unavailable evidence. Facts cite their Rule, emission, closure, and value or traversal evidence. A verified saved plan can provide traversal evidence even when the evaluated value is unknown.

A plan may include planned, refreshed, and reconstructed recorded stages. The recorded stage may be partial. Its internal drift comparison describes producer-reported outside changes between recorded and refreshed state. [Cross-input comparisons](concepts/diff.md) compare selected stages of separate inputs and are never drift. [Policies](concepts/policies.md) evaluate a selected stage; missing or uncertain evidence cannot become a pass.
