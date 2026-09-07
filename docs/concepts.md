---
title: "Core concepts"
description: "Understand architecture meaning, provenance, and governance before interpreting a Rootform result."
---

Rootform separates the evidence in your Terraform/OpenTofu source, the
architectural meaning established by Dialects, and the policies used to evaluate
that architecture. Understanding those boundaries makes the result useful.

## Architecture and evidence

[Architecture IR](concepts/architecture-ir.md) is the saved semantic document.
It records each discovered declaration's outcome and the provenance behind
established facts. The renderer displays that meaning without inventing more.
References and Terraform dependencies are evidence, not automatic relations.

## Dialects

[Dialects](concepts/dialects.md) define provider semantics. They decide what a
declaration means: an entity, scope, supporting detail, context, relation, or
composition. Exact selection is part of a reproducible architecture.

## Governance

[Policies and Policy Packs](concepts/policies.md) evaluate meaning already
established in the architecture. Policies belong to Policy Packs, never to
Dialects. Selection is explicit. An indeterminate result is not a pass.

## Reproducibility

A lock records exact selection. Vendor and the installed store supply verified
local content. [Offline operation](offline-security.md) controls acquisition
separately from selection. Equivalent inputs and configuration produce
equivalent output; unknown input remains visible.
