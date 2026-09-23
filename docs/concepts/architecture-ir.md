---
title: "Architecture IR"
description: "Understand how saved architecture supports inspection, comparison, explanation, and policy evaluation."
---

Architecture IR is Rootform's saved provider-neutral architecture document. It
provides durable evidence for four common uses.

- Explore resources in their architectural Contexts
- Explain how source evidence and a Rule produced a placement or connection
- Compare architectural meaning between revisions
- Evaluate architecture against selected [Policies](policies.md)

Consumers read the document without reopening Terraform source or reloading
producer Dialects. Policy selection remains separate and never becomes part of
the architecture document.

## Document captures one semantic snapshot

Architecture IR records declarations, normalized resource bases, architectural
facts, provenance, diagnostics, and the exact semantic contracts used to
interpret source. The same document can be inspected later even when the
current Rootform binary contains newer embedded Dialects.

The semantic snapshot includes the RF Language version, release-set identity, RF
Vocabulary, Dialects, effective exclusions and replacements, definitions,
Rules, and emission contracts. Diff uses this snapshot to decide which
conclusions remain comparable. Policy linking resolves qualified references
against it.

## Sections separate concerns

| Section | Contents |
| --- | --- |
| `format_version`, `generator` | Document contract version and producer identity |
| `source` | Normalization contract, declarations, locations, dependencies, and source accounting |
| `semantics` | Release set, effective selection, owners, definitions, Rules, and emissions |
| `architecture` | Representations, Contexts, Contributions, Relations, omissions, and architecture accounting |
| `resolutions` | Bounded provenance behind established facts |
| `diagnostics` | Canonical sanitized diagnostics tied to phase and object |

`format_version` identifies the data contract. The Rootform binary version
identifies the producer implementation. They are independent and must not be
substituted for one another.

## Stable identities and canonical order remove noise

Every stable object has a content-derived identity rather than a display label
or array position. Source and representation identities derive from normalized
source identity. They do not depend on Rule, Concept, icon, version, or textual
location.

Collections serialize in canonical order. Equivalent supported input and exact
semantic selection therefore produce deterministic bytes. Editing generated
JSON by hand can break identities, references, ordering, accounting, closure,
or provenance.

## Accounting keeps partial knowledge honest

Architecture IR accounts for five axes separately.

| Axis | Question answered |
| --- | --- |
| Source | Which declarations and evidence were discovered? |
| Representation | Which declarations gained architecture representations? |
| Interpretation | Which Rule applied, or why did interpretation not apply? |
| Composition | Which proven members support a composed representation? |
| Emission | Which facts, omissions, or diagnostics close an active emission? |

Every source declaration is accounted for exactly once. Every normalized
resource has a representation, even without a Rule. A data declaration without
a successful Rule remains source-accounted without a representation. This is
valid partial knowledge, not dropped input.

## Facts preserve bounded provenance

Contexts, Relations, Contributions, and Compositions connect existing
representations according to Rule meaning. They are not raw Terraform
dependencies. Each established fact names the bounded resolution, Rule, and
emission that justify it.

An active emission closes with confirmed facts, a proven omission, or a
diagnostic. An omission means the relevant fact is conclusively absent. Unknown,
ambiguous, partially dangling, or incomparable evidence produces a diagnostic
instead. Confirmed facts and an incompleteness diagnostic can coexist when a
query resolves only in part.

Provenance explains an architectural claim without embedding raw configuration
values.

## Valid partial document differs from invalid document

Valid Architecture IR may include Rule-free resource bases, data declarations
without representations, proven omissions, and diagnostics. Those states make
limits explicit while preserving usable evidence.

A document becomes structurally invalid when its contract cannot be trusted.
Examples include unsupported format version, forbidden unknown fields, invalid or
duplicate identities, dangling references, noncanonical order, inconsistent
accounting, unresolved successful provenance, or active emission without
closure.

An invalid document supports no compliance or no-change claim. Consumers must
reject it rather than silently ignore a damaged section.

## Saved evidence still needs handling rules

Architecture IR excludes raw HCL, secrets, raw plans and state, absolute paths,
`.rf.hcl` source, and UI state. It still contains source addresses,
relative locations, resource names, Concepts, and architectural connections.
Those can reveal project structure.

Review the document before sharing. Apply repository access, artifact retention,
and review-channel rules. Diff and Policy reports inherit portions of the same
sensitive architecture evidence.

```sh
rootform build . --output architecture.json
rootform explain architecture aws_subnet.application --input architecture.json
```

This concept page gives a mental model. Exact normalization, validation,
identifiers, and field requirements live in
[Architecture IR contract](../../contracts/architecture-ir.md) and
[JSON Schema](../../schemas/architecture-ir.schema.json). Continue with
[Explore an architecture](../guides/explore-architecture.md),
[Architecture Diff](diff.md), or [Policies and Policy Packs](policies.md).
