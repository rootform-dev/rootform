---
title: "Compare architectures"
description: "Read architecture changes and distinguish a determined change from unavailable evidence."
---

Rootform Diff compares architectural meaning between a base and a head. It
ignores source formatting and provenance-only changes. Both inputs must be
valid and use the same Dialect selections.

See the [release note](../installation.md#available-release) for availability of
the current renderer controls.

## Compare saved architectures

```sh
rootform diff before.json after.json
```

Changes do not fail this command by default. Add `--exit-code` when an automation
should return status `1` for a difference. Invalid or incomparable input returns
an unavailable result, not a reassuring empty comparison.

## Read the current Diff renderer

The current renderer presents one change-aware architecture with added, removed,
changed, and unresolved evidence. Base provides prior placement; head supplies
current facts. Inspector explains before/after details. Survey, Plan, and Focus
remain the exploration controls.

An unambiguous containment move can be presented as a move. Ambiguous or
undetermined contexts must not be turned into a confident move or deletion.

For a planned change, use [a Terraform/OpenTofu JSON plan](../inputs/plans.md).
For a repository review, start with [Git and pull-request workflows](../workflows/index.md).
The [Architecture Diff contract](../../contracts/architecture-diff.md) defines
machine results and comparison safety rules.
