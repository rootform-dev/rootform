# Architecture document contract

Current format version: `"1"`.

Rootform serializes architecture as one document family. The [JSON Schema](../schemas/architecture-ir.schema.json) defines exact fields, types, bounds, and validation. Consumers validate documents before drawing conclusions from them. Format version and executable version are independent.

## Document kinds

| `kind` | Evidence and contents |
| --- | --- |
| `snapshot` | One `recorded` stage from a state JSON export. No planned stage or drift report. |
| `plan` | A `planned` stage and, when prior evidence supports them, `refreshed` and reconstructed `recorded` stages. Supported internal comparisons and drift report. |
| `comparison` | Two embedded analysis documents, selected sides and stages, and one `cross` comparison. A difference between separate inputs is never called drift. |

An analysis document has `generator`, `evidence`, `semantics`, `stages`, `default_stage`, and `diagnostics`. A plan also carries supported `comparisons` and `drift_report`. A comparison document has `before`, `after`, `comparison`, `generator`, and `diagnostics`. Embedded sides are analysis documents. Saved documents retain their semantic definitions and reopen without resolving the original Dialects.

## Evidence and stages

`evidence.origin` identifies a plan or state export. Producer identity and input format retain their uncertainty. `completeness` distinguishes producer-declared completeness, attestation, and unavailable information. `enrichment` records whether an optional saved plan verified and supplied configuration snapshot evidence. `scope` records drift record presence and refresh and drift coverage limits.

Each stage has declarations, representations, facts, closures, dependencies, accounting, and diagnostics. `planned` describes the proposed outcome. `refreshed` describes the producer's prior snapshot. A plan's `recorded` stage reconstructs values before reported drift and may be partial. A state input has one `recorded` stage representing its exported state. Stage absence cannot be treated as empty architecture.

Representation identity is the Terraform or OpenTofu instance address. An instance without an applicable Rule remains represented without an invented Concept or fact. Relations are emitted architectural claims, not raw dependency edges. Source dependencies remain separate evidence.

## Emissions, closures, and facts

`semantics` records selected definitions, Rules, and emission contracts. An emission may declare `via`, `on_null`, `on_empty`, `external`, `disclose`, `prefix`, and a `match` whose `by` array tries target identity attributes in order. `match.strategy` is `exact`, `dot-ancestor`, or `last-segment`. Rule identity scope is `provider` or `global`.

Each active emission has one closure per source instance. Its `outcome` is `resolved`, `absent`, or `indeterminate`. An indeterminate closure carries one of `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `reference_ambiguous`, `identity_incomplete`, `unavailable`, `external_denied`, or `duplicate_identity`. `reference_ambiguous` means a verified traversal and an evaluated value name different endpoints. An eligible unknown or uncomparable candidate cannot be ignored to claim a unique endpoint or synthesize an external endpoint.

Every fact cites its closure, emission, Rule, and evidence kind: `value`, `traversal`, or `both`. Traversal evidence comes from a verified saved-plan snapshot. It can name a target when values are unknown or shared, including across providers. A known value that conflicts with the traversal produces a diagnostic. Sensitive values are never serialized.

External endpoint identity follows the declared `disclose` tier. Document-local external ordinals are not identities for matching separate documents. A display copy may withhold recorded external identities.

## Comparisons and drift

Within a plan, `drift` compares recorded to refreshed, `planned` compares refreshed to planned, and `net` compares recorded to planned. Each comparison states its sides, comparability, counts, representation and fact changes, undetermined entries, problems, and cancelled changes where applicable. A fact is added or removed only when the other side's relevant closure proves absence. Unknown or incomplete evidence remains undetermined.

`drift_report.entries` correspond to producer-reported drift records. Each has a consequence of `architectural`, `none_under_dialects`, `undetermined`, `uncovered`, or `address_only`. Moves and replacements are never themselves labelled drift. Absence of reported records is expressed as “No drift reported in this plan” with the plan's scope; it does not prove that no drift occurred.

`run --diff` produces a `comparison` document. It selects one stage on each side and records a `cross` comparison. A comparison between separate inputs does not establish what changed outside Terraform or OpenTofu.

## Validation and privacy

Decoders reject unsupported versions, unknown fields, invalid or duplicate identities, dangling references, noncanonical order, inconsistent accounting, and missing emission closure. A rejected document supports no compliance or no-change claim. Raw plan, state, configuration, sensitive values, host paths, and renderer layout are outside this document contract.
