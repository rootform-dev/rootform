---
title: "Architecture Diff"
description: "Understand how Rootform compares architectural meaning while preserving uncertainty and semantic boundaries."
---

Architecture Diff compares two validated Architecture IR documents. It reports
changes in representations and architectural facts, not source text edits,
Terraform actions, provenance-only changes, or screen layout.

## Continuity starts with source identity

A representation's stable identity derives from normalized source identity. The
same source declaration can therefore keep its identity while a Rule, Concept,
facts, or composition change. Diff can report changed interpretation without
pretending a resource was removed and added.

Continuity requires comparable source scope and normalization. Rootform does
not pair `resource` and `data` declarations because names match. It does not
infer physical cloud identity from provider type, label, or remote identifier.

## One edit can create several architectural changes

Adding a subnet can add a resource representation and a network Context toward
an existing VPC. Diff reports both because they answer different questions.
Representation says the subnet exists. Context says how the subnet is placed in
the network architecture.

Collections use `added`, `removed`, and `changed` classifications. Exact
machine-level changed fields are `concept`, `kind`, `name`,
`implementation_kind`, `members`, `dimension`, `predicate`, `from`, and `to`.

There is no `moved` classification. A Context move is the removed old Context
plus the added new Context. A retargeted Relation follows the same pattern.

## Source action and architecture change are different

A Terraform replacement can produce no Architecture Diff when both sides retain
the same normalized source identity and the same meaning. Formatting and array
order also produce no change.

The opposite can happen without adding or removing a resource. Dialect Rule
evolution can change Concept, Context, Relation, Contribution, or Composition
for a stable representation. Diff reports the resulting architectural meaning,
not the Rule source edit itself.

Provenance explains a change but does not become an architecture change when the
facts remain the same.

## Undetermined preserves uncertainty

Diff reports `undetermined` when one side cannot establish whether a
representation or fact is absent. Causes include unresolved evidence,
incomplete emission closure, incompatible semantic units for the affected fact,
or source identity that cannot be paired safely.

A valid report can contain determined changes and undetermined entries together.
Invalid input instead produces a comparison problem. It never becomes an empty
no-change report.

A semantic difference does not automatically invalidate the entire comparison.
Each Architecture IR records RF Language, RF Vocabulary, Dialects, Rules,
emissions, and effective selection. Diff preserves comparable source continuity
and marks only conclusions it cannot establish safely as undetermined.

To isolate infrastructure edits, build both revisions with the same Rootform
binary and comparable Dialect selection. To review an intentional semantic
update, keep each revision's own selection and read affected undetermined
conclusions as part of the change.

## Read command status with report contents

```sh
rootform diff before.json after.json
rootform diff before.json after.json --format markdown --output architecture-diff.md
rootform diff before.json after.json --exit-code
```

| Status | Meaning |
| --- | --- |
| `0` | Comparison completed. Without `--exit-code`, report may still contain changes or undetermined entries |
| `1` | With `--exit-code`, at least one determined or undetermined difference exists |
| `2` | Command usage is invalid |
| `3` | Comparison could not complete |

Report content remains the primary evidence. An empty report means no determined
changes and no undetermined entries, not merely a successful process.

Use [Compare architectures](../guides/compare-architectures.md) to produce and
read a first report, [plan Diff](../inputs/plans.md#compare-both-sides-of-one-plan)
when one plan supplies both sides, and [Review a pull request](../workflows/index.md)
for isolated Git revisions and saved review artifacts. Exact classifications
and validity rules live in [Architecture Diff contract](../../contracts/architecture-diff.md).
