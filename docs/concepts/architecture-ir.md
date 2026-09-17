---
title: "Architecture IR"
description: "Understand the saved architecture document: sections, identities, accounting, closure, and what makes it valid."
---

Architecture IR is Rootform's saved, provider-neutral architecture document. It
records every discovered declaration, every normalized resource base, the exact
semantic contracts used to interpret those bases, and the evidence behind each
established fact. Consumers read this document without reinterpreting Terraform.

## Document sections

| Section | Contents |
| --- | --- |
| `format_version`, `generator` | Document contract version and producer identity |
| `source` | Normalization contract, declarations, locations, source dependencies, and source accounting |
| `semantics` | RF language version, release-set identity and units, effective selection, owners, definitions, Rules, and emission contracts |
| `architecture` | Uniform representations, contexts, contributions, relations, omissions, and architecture accounting |
| `resolutions` | Bounded provenance records that back successful facts |
| `diagnostics` | Canonical sanitized diagnostics tied to their phase and object |

`format_version` is independent of the executable version. Use `rootform version` to identify the binary and `format_version` to identify the document contract.

## Identities and ordering

Every stable object uses content-derived identity, never a display label or array position. Source IDs and representation IDs derive from the normalized identity of the source root; they never depend on Rule, Concept, label, icon, version, or textual location. Collections serialize in canonical order, independent of traversal order. Editing generated JSON by hand can break identities, references, accounting, closure, or provenance.

## Five accounting axes

The document accounts the source, representation, interpretation, composition, and emission axes separately, with coherent links between them.

| Axis | Question it answers |
| --- | --- |
| Source | Which declarations were discovered, and which source evidence was available? |
| Representation | Which declarations have representations? |
| Interpretation | Which Rule applied to each representation, and did selection or application fail? |
| Composition | Which proven members support a composed representation? |
| Emission | Which facts, omissions, or diagnostics close each active emission? |

Representation coverage and Rule coverage are distinct. Resource bases count in representation accounting even when no Rule applies. A missing Rule never means an unsupported resource, and a data declaration without successful interpretation remains source-accounted without a representation.

## Uniform representations

`architecture.representations` is the single representation collection. Each
representation references its source declaration, carries its name and direct
or composed implementation, and can carry an applied Rule and optional Concept.
The source declaration holds kind, type, address, provider evidence, and
location. Rule and Concept are omitted when absent; no synthetic Rule, generic
Concept, or architectural fact is created for coverage.

A Rule-free resource base remains valid and complete about structural existence. Contexts, relations, contributions, and memberships connect existing representations. None turns a raw Terraform dependency into architecture meaning automatically.

## Semantic snapshot and release set

`semantics` records the RF language version, the release set with its identity, version, manifest digest, and each unit's owner, kind, version, content digest, and semantic digest, the effective selection of active, excluded, and replaced owners, and each owner's origin, provider envelopes, and dependencies. Consumers of a saved document use only this snapshot. They never reload producer Dialects and never substitute the release set embedded in a newer binary. [Architecture Diff](diff.md) keeps source continuity while reporting incompatible semantic environments as undetermined.

## Facts close with evidence

Each active emission on an applied Rule closes with one or more confirmed facts, one proven omission, or an emission-scoped diagnostic. An omission is exclusive and means conclusively empty. Unknown, ambiguous, partially dangling, or incomparable evidence produces a diagnostic; it never proves absence. Confirmed facts and an incompleteness diagnostic can coexist when only part of a query is known. Missing closure is invalid.

Facts carry bounded provenance naming the successful resolution, Rule, and emission. Provenance explains why a fact exists without embedding raw configuration or values.

## Partial is not invalid

A document is normally partial. Resource bases without an applied Rule, data
declarations without representations, and explicit diagnostics are valid and
expected. Unknown or unsupported input stays explicit; a document with unknown
data is never truncated and presented as complete.

A document is invalid when it has an unsupported `format_version`, forbidden unknown fields, invalid identifiers, dangling references, duplicate identities, noncanonical ordering, inconsistent accounting, references, or closure, unresolved successful provenance, or an active emission without closure. A rejected document supports no compliance or no-change claim in any consumer.

## Saved IR stays self-contained

```sh
rootform build . --output architecture.json
rootform explain architecture aws_subnet.application --input architecture.json
```

A saved document is self-contained for inspection, Diff, explanation, Policy
linking, and Policy evaluation. Consumers use its semantic snapshot; linking on
a saved document uses only that snapshot. Policy Pack selection does not modify
the document.

The document excludes raw HCL, secrets, raw plans and state, absolute paths,
`.rf` source, and UI state. Equivalent inputs and exact semantic selections
produce deterministic output. Source addresses and relative locations remain in
the document, so review it before sharing.

## Read the contract

The [Architecture IR contract](../../contracts/architecture-ir.md) and [JSON Schema](../../schemas/architecture-ir.schema.json) define the public format. Use them when building a consumer. [Architecture Diff](diff.md) explains comparison, and [Core concepts](../concepts.md) places the document in the mental model.
