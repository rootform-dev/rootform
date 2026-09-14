---
title: "Architecture Diff"
description: "Understand how Rootform compares stable representations, architectural facts, and incomplete evidence."
---

Architecture Diff compares two validated Architecture IR documents. It reports
changes in architectural meaning, not text edits, Terraform actions, screen
layout, or provenance-only differences.

Use `rootform diff` with two source directories, two saved architecture files,
or both sides of one Terraform/OpenTofu JSON plan.

## Continuity starts with source identity

A resource representation keeps its ID while its Rule, Concept, facts, or
composition memberships change. This lets Diff distinguish a changed
interpretation from a resource addition or removal.

Continuity requires the same source-normalization contract and comparable
source scope. Rootform does not merge a `resource` and a `data` declaration
because they look related, and it does not infer physical identity from names
or provider types.

## Facts carry architectural change

Diff compares four collections:

- representations;
- contexts;
- contributions;
- relations.

Entries are `added`, `removed`, or `changed`. A context move is represented by
one removed context and one added context. A retargeted relation follows the
same pattern. Rule, emission, resolution, and provenance can explain a change,
but changing only that evidence does not create an architecture change.

Formatting changes and array order do not matter. A Terraform replacement can
also leave architecture unchanged when both sides establish the same
representations and facts.

## Unknown is not absence

Rootform reports an `undetermined` entry when one side cannot prove whether a
fact or representation is absent. Common causes include unresolved evidence,
incomplete emission closure, incompatible semantic environments, or source
identity that cannot be paired safely.

This is different from a failed comparison. A valid Diff can contain both
determined changes and undetermined entries. Invalid input produces a problem,
never an empty no-change report.

## Semantic changes need separate review

Each Architecture IR records its RF Language version, RF Vocabulary, Dialects,
definitions, Rules, emissions, and effective selection. When these semantic
environments differ, source continuity can remain comparable while
interpretation and fact conclusions become undetermined.

To isolate infrastructure change from Dialect change, build both source
revisions with one exact semantic set. Saved IR alone cannot reanalyze old
source under newer Dialects.

## Read command status with report contents

```sh
rootform diff before.json after.json
rootform diff before.json after.json --format markdown --output architecture-diff.md
rootform diff before.json after.json --exit-code
```

Status `0` means comparison completed. Without `--exit-code`, a completed
report can still contain changes or undetermined entries. With `--exit-code`,
either makes status `1`. Status `3` means comparison could not complete.

Continue with [Compare two architectures](../guides/compare-architectures.md),
[plan inputs](../inputs/plans.md), or the
[Architecture Diff contract](../../contracts/architecture-diff.md).
