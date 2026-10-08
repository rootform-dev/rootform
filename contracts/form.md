# Form contract

Current format version: `"1"`.

A Form is the portable architectural model Rootform compiles from Terraform or OpenTofu evidence. It is the complete result a user saves, opens, compares, and may later publish. It contains the architecture of every stage its evidence supports, the comparisons those stages allow, the drift the plan reports, and the evidence record, semantic pins, limits, and diagnostics needed to read it without the original files or installed Dialects. A Form is derived, never authored or edited. Save a Form. Open a Form. Compare two Forms.

JSON is the Form's serialization. The [JSON Schema](../schemas/form.schema.json) defines exact fields, types, bounds, and validation. Consumers validate Forms before drawing conclusions. Form format version and executable version are independent. Format 1 has no aliases for incompatible field names. An older file that satisfies the current contract remains valid.

## Stages and architectures

A stage is the role of one architecture within a Form, never a Form itself. Recorded, Refreshed, and Planned are the prose labels; JSON uses `recorded`, `refreshed`, and `planned`. `stages` is keyed by stage, and each entry is an Architecture with `stage`, `label`, optional `reconstruction`, and architectural content. The content includes Representations, Concepts, Contexts, Relations, Contributions, closures, declarations and populations, dependencies, accounting, and diagnostics. Say "the Planned architecture" or "the Refreshed stage".

A state Form has one Recorded architecture, as recorded in the state export. A plan Form has a Planned architecture describing what the plan proposes; values unknown until apply remain indeterminate. Its Refreshed architecture is the state the plan starts from. The plan does not record whether or how far refresh ran. Recorded is reconstructed from the plan's drift records and may be partial. Only supported stages are present; an unavailable stage is not an empty architecture.

For accepted plan format 1.x, Terraform and OpenTofu omit `prior_state` exactly when the state before the plan holds no resource and no root output. Rootform then records an empty Refreshed stage and reconstructs Recorded by reversing the drift records. Recorded can contain an instance deleted during refresh even when Refreshed is empty. Exports from Terraform 1.12.2 and OpenTofu 1.10.7 are qualified; other 1.x exports are accepted by shape.

An instance present before the plan that the plan neither changes nor deletes remains in the Planned architecture with status `carried`. This includes instances outside `-target` or `-exclude`, or in a refresh-only plan. A carried instance is not reported as deleted. The plan did not evaluate it: its population is unverified, its properties are not confirmed by the plan, and Policies cannot pass or fail on missing evidence from it. Their evaluation stays indeterminate where that evidence matters.

## Form kinds and serialization

The root schema is a union of `InputForm` and `ComparisonForm`.

| `kind` | Evidence and contents |
| --- | --- |
| `state` | One Recorded architecture from a state JSON export; no comparisons or drift report. |
| `plan` | Planned, Refreshed, and reconstructed Recorded architectures when supported; available comparisons and a drift report. |
| `comparison` | Two complete embedded state or plan Forms, selected stages, and one `cross` comparison named Differences. |

An InputForm has `generator`, `evidence`, `semantics`, `stages`, `default_stage`, and `diagnostics`. A plan also has `comparisons` and `drift_report`. `default_stage` names a present stage. A ComparisonForm has `before`, `after`, `comparison`, `generator`, and `diagnostics`. Each side embeds a complete input Form under `form`, together with the selected `stage` and `selected_from` (`input`, `before`, or `after`). A comparison Form never embeds another comparison Form. It reopens alone with `rootform run comparison.json` and is refused as a `--diff` operand. Saved Forms retain their semantic definitions and reopen without resolving original Dialects.

## Evidence, Representations, and facts

`evidence.origin` identifies a plan or state export. Producer identity and input format retain their uncertainty. `completeness` distinguishes producer-declared completeness, attestation, and unavailable information. `enrichment` records whether an optional saved plan verified and supplied configuration snapshot evidence. Pairing verifies version, timestamp, and configuration shape, but does not prove one planning operation. `scope` records drift record presence and refresh and drift coverage limits.

Human displays name the Producer only when `evidence.producer.tool` is `terraform` or `opentofu`, as `Terraform` or `OpenTofu`, without a version. An `unestablished` tool has no Producer row. Reported versions, file names and provider registry hints never establish tool identity. The Form keeps `reported_version`, `hints`, `tool_source` and attestations regardless of display.

In a comparison provenance table, an unestablished side has an empty Producer cell. When neither side is established, the whole row is omitted.

Representation identity is the Terraform or OpenTofu instance address. An instance without an applicable Rule remains represented without an invented Concept or fact. Relations are emitted architectural claims, not raw dependency edges. Source dependencies remain separate evidence.

`semantics` records selected definitions, Rules, and emission contracts. An emission may declare `via`, `on_null`, `on_empty`, `external`, `disclose`, `prefix`, and a `match` whose `by` array tries target identity attributes in order. `match.strategy` is `exact`, `dot-ancestor`, or `last-segment`. Rule identity scope is `provider` or `global`.

Each active emission has one closure per source instance. Its `outcome` is `resolved`, `absent`, or `indeterminate`. An indeterminate closure follows `$defs.IndeterminateClosure` and carries one of `unknown_until_apply`, `sensitive`, `ambiguous_unknown`, `uncomparable_candidate`, `reference_ambiguous`, `identity_incomplete`, `unavailable`, `external_denied`, or `duplicate_identity`. `reference_ambiguous` means a verified traversal and an evaluated value name different endpoints. An eligible unknown or uncomparable candidate cannot be ignored to claim a unique endpoint or synthesize an external endpoint.

Every fact cites its closure, emission, Rule, and evidence kind: `value`, `traversal`, or `both`. Traversal evidence comes from a verified saved-plan snapshot. It can name a target when values are unknown or shared, including across providers. A known value that conflicts with traversal produces a diagnostic. Sensitive values are never serialized.

External endpoint identity follows the declared `disclose` tier. Form-local external ordinals are not identities for matching separate Forms. A display copy may withhold recorded external identities.

## Comparisons and drift report

Within a plan, `comparisons.changes` is Planned changes (Refreshed to Planned), `comparisons.drift` is Reported drift (Recorded to Refreshed), and `comparisons.net` is Net change (Recorded to Planned). Each is present exactly when both stages exist. Drift the plan reverts cancels out of Net change. Each comparison states its sides, comparability, counts, Representation and fact changes, `indeterminate` entries, problems, and cancelled changes where applicable. A fact is added or removed only when the other side's relevant closure proves absence. Unknown or incomplete evidence remains indeterminate.

`drift_report.entries` list the producer's drift records with their architectural consequences: `architectural`, `none_under_dialects`, `indeterminate`, `uncovered`, or `address_only`. The drift report is distinct from the Reported drift comparison. Moves and replacements are not themselves labelled drift. "No drift reported in this plan" is scoped to the plan's records; it does not prove no drift occurred.

`rootform run before.json --diff after.json` produces a comparison Form with a `cross` comparison named Differences. It selects one stage on each side and never labels cross-input differences drift. Semantic selections and release sets affect comparability. Cross-input matching uses disclosed external identities and Concept meaning, never Form-local ordinals. Withheld or unavailable identity can leave a fact indeterminate. An empty comparable result with no indeterminate entries means no architectural change under selected Dialects and evidence scope; it makes no claim about unmodeled infrastructure.

## Identity, validation, and privacy

The canonical digest identifies the serialized Form bytes, not architectural equivalence. Canonical bytes include generator version and exclude timestamps and local paths. Two Forms can differ in bytes with no determined architectural change; semantic comparison is separate. A diagram is a view of a Form. "Analysis" names the process, as in "Plan analyzed", rather than another saved object.

Decoders reject unsupported versions, incompatible fields, invalid or duplicate identities, dangling references, noncanonical order, inconsistent accounting, and missing emission closure. A rejected Form supports no compliance or no-change claim. Raw plan, state, configuration, sensitive values, host paths, and renderer layout are outside this contract. Use diagnostics, scope, closure outcomes, and comparison problems before treating a result as a gate; command exit status alone does not express every evidence limit. Validate with `rootform validate form <file>`. `rootform run` labels saved single-input content "Form loaded", identifies it with a "Form" row, and lists its "Stage", "Stages", and "Architecture" when applicable. A saved comparison is labelled "Comparison Form loaded" and shows Before and After counts.
