# Rootform document contract

Current format version: `"1"`.

A Rootform document is the saved JSON of an analysis or an input comparison. An analysis is everything Rootform derives from one input: its Forms, comparisons, drift report, evidence record, semantics, and diagnostics. The [JSON Schema](../schemas/rootform-document.schema.json) defines exact fields, types, bounds, and validation. Consumers validate documents before drawing conclusions. Format version and executable version are independent. Format 1 has no aliases for earlier field names; old documents are rejected.

## Forms and stages

A Form is the architecture Rootform establishes from one stage of one input's evidence: Representations of Concepts, the Contexts, Relations and Contributions that Dialect Rules establish, and closures recording what the evidence settles, leaves absent or leaves indeterminate. It belongs to exactly one analysis and one stage, carries no attribute values (only external identities a Dialect discloses), and may be partial with explicit gaps. A Form is derived, never authored or edited.

Stages are Recorded, Refreshed and Planned in prose and labels. Their JSON values are `recorded`, `refreshed` and `planned`. A state analysis has one Recorded Form. A plan has a Planned Form and, when it carries prior state, a Refreshed Form and a reconstructed Recorded Form that may be partial. Missing Forms cannot be treated as empty architecture.

## Document kinds

| `kind` | Evidence and contents |
| --- | --- |
| `state` | One Recorded Form from a state JSON export. No Planned Form or drift report. |
| `plan` | A Planned Form and, when prior state exists, Refreshed and reconstructed Recorded Forms. Supported comparisons and drift report. |
| `comparison` | Two embedded analyses, selected Before and After stages, and one input comparison named `cross`. Differences between separate inputs are never drift. |

For an analysis, the Rootform document has `generator`, `evidence`, `semantics`, `forms`, `default_stage`, and `diagnostics`. `forms` is keyed by stage; each value follows `$defs.Form`. A plan also carries supported `comparisons` and `drift_report`. For an input comparison, the Rootform document has `before`, `after`, `comparison`, `generator`, and `diagnostics`; both embedded sides are analyses. Saved documents retain their semantic definitions and reopen without resolving original Dialects. `default_stage` names the Form that readers and input comparisons select when no stage is requested.

## Evidence, Representations, and facts

`evidence.origin` identifies a plan or state export. Producer identity and input format retain their uncertainty. `completeness` distinguishes producer-declared completeness, attestation, and unavailable information. `enrichment` records whether an optional saved plan verified and supplied configuration snapshot evidence. `scope` records drift record presence and refresh and drift coverage limits.

Each Form has declarations, Representations, facts, closures, dependencies, accounting, and diagnostics. Planned describes the proposed outcome. Refreshed describes prior state after refresh. A plan's Recorded Form reconstructs state before reported drift and may be partial. A state input has one Recorded Form representing its exported state.

Representation identity is the Terraform or OpenTofu instance address. An instance without an applicable Rule remains represented without an invented Concept or fact. Relations are emitted architectural claims, not raw dependency edges. Source dependencies remain separate evidence.

## Emissions and closures

`semantics` records selected definitions, Rules, and emission contracts. An emission may declare `via`, `on_null`, `on_empty`, `external`, `disclose`, `prefix`, and a `match` whose `by` array tries target identity attributes in order. `match.strategy` is `exact`, `dot-ancestor`, or `last-segment`. Rule identity scope is `provider` or `global`.

Each active emission has one closure per source instance. Its `outcome` is `resolved`, `absent`, or `indeterminate`. An indeterminate closure follows `$defs.IndeterminateClosure` and carries one of `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `reference_ambiguous`, `identity_incomplete`, `unavailable`, `external_denied`, or `duplicate_identity`. `reference_ambiguous` means a verified traversal and an evaluated value name different endpoints. An eligible unknown or uncomparable candidate cannot be ignored to claim a unique endpoint or synthesize an external endpoint.

Every fact cites its closure, emission, Rule, and evidence kind: `value`, `traversal`, or `both`. Traversal evidence comes from a verified saved-plan snapshot. It can name a target when values are unknown or shared, including across providers. A known value that conflicts with traversal produces a diagnostic. Sensitive values are never serialized.

External endpoint identity follows the declared `disclose` tier. Document-local external ordinals are not identities for matching separate documents. A display copy may withhold recorded external identities.

## Comparisons and drift report

Within a plan, `comparisons.changes` is Planned changes (Refreshed to Planned), `comparisons.drift` is Reported drift (Recorded to Refreshed), and `comparisons.net` is Net change (Recorded to Planned). Drift that the plan reverts cancels out of Net change. Each comparison states its sides, comparability, counts, Representation and fact changes, `indeterminate` entries, problems, and cancelled changes where applicable. A fact is added or removed only when the other side's relevant closure proves absence. Unknown or incomplete evidence remains indeterminate. Comparison lists and counts use `indeterminate`.

`drift_report.entries` correspond to drift entries Terraform or OpenTofu report in a plan. Rootform qualifies each with an architectural consequence: `architectural`, `none_under_dialects`, `indeterminate`, `uncovered`, or `address_only`. The drift report is distinct from the Reported drift comparison. Moves and replacements are never themselves labelled drift. Absence of reported records is expressed as “No drift reported in this plan” with the plan's scope; it does not prove no drift occurred.

`rootform run before.json --diff after.json` produces an input comparison document. It selects one stage on each side, names the sides Before and After, and records a `cross` comparison. An input comparison shows differences; it cannot establish what changed outside Terraform or OpenTofu. Semantic selections and release sets are part of comparability. Cross-input matching uses disclosed external identities and Concept meaning, never document-local ordinals. Withheld or unavailable identity can leave a fact indeterminate. An empty comparable result with no indeterminate entries means no architectural change under selected Dialects and evidence scope; it makes no claim about unmodeled infrastructure.

## Validation and privacy

Decoders reject unsupported versions, old aliases, unknown fields, invalid or duplicate identities, dangling references, noncanonical order, inconsistent accounting, and missing emission closure. A rejected document supports no compliance or no-change claim. Raw plan, state, configuration, sensitive values, host paths, and renderer layout are outside this document contract. Use diagnostics, scope, closure outcomes, and comparison problems before treating a result as a gate; command exit status alone does not express every evidence limit.
