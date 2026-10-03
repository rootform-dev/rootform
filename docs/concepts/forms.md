---
title: "Forms and stages"
description: "Read saved Forms, their architectures, and evidence limits."
---

A saved Form preserves Rootform's architectural interpretation so you can reopen it, inspect its evidence, evaluate Policies against it, or compare it with another Form. `rootform run` creates a Form; `rootform run analysis.json` reopens it in the Explorer, `rootform explain` reads its evidence, `rootform check` evaluates selected Policies, and `--diff` compares two input Forms. A Form is derived: you save, reopen, and compare it, but never author or edit it.

A Form serializes as JSON, format version `"1"`. It retains the analyzed architectures, facts, evidence, and semantic identities used to interpret them, so it reopens without the original plan or state JSON or installed Dialects. The Explorer is one view of the saved result. "Analysis" describes the process, as in "Plan analyzed", rather than another saved object. The [contract](../../contracts/form.md) and [JSON Schema](../../schemas/form.schema.json) define its fields.

## The Form captures its input and meaning

| `kind` | Input or operation | Contents |
| --- | --- | --- |
| `state` | State JSON | One Recorded architecture (`recorded`) |
| `plan` | Plan JSON | Planned architecture (`planned`), plus supported Refreshed and reconstructed Recorded stages; comparisons and a drift report |
| `comparison` | `run` with `--diff` | Two embedded state or plan Forms and one selected cross-input comparison |

A state or plan Form records its supported stages, default stage, and the exact vocabulary, Dialects, Rules, and emissions used for interpretation. Reopening uses those recorded definitions rather than applying today's Dialects to older evidence. The contract and schema define the JSON fields.

Form evidence distinguishes what the export reports from claims supplied through `--producer` and `--plan-complete`. When `--plan-file` is used, its pairing status is recorded as `verified`, `refused`, or `absent`. Pairing checks version, timestamp, and configuration shape; it does not prove that both files came from one planning operation.

## Stages and facts

A stage is the role Recorded, Refreshed, or Planned of one architecture, never a Form. A plan's Planned architecture describes what the plan proposes; values unknown until apply are indeterminate. Refreshed is the state the plan starts from; the plan does not record whether or how far refresh ran. Recorded reconstructs state from the plan's drift records and can be partial. A state JSON has only Recorded, as recorded in the state export. Rootform does not infer that a plan refreshed every resource. An unavailable stage is not empty.

Each architecture records declarations and their population, per-instance Representations and interpretation, architectural facts, closures, dependencies, diagnostics, and accounting. Managed and data instances both get Representations. A Representation has an instance address, provider identity, status, and any applied Rule and Concept. An instance stays represented without a matching Rule or selected provider Dialect; [How Rootform works](../concepts.md#every-observed-instance-starts-with-a-representation) explains that boundary. Dependency ledger entries do not become Relations by themselves. Forms carry no attribute values, only external identities a Dialect discloses.

Contexts, Relations, and Contributions join Representations according to a Rule's declared meaning. Composition members appear under the root's implementation. An external endpoint can appear when a Dialect permits one; its identity is recorded only at the Dialect's disclosure tier. The [Dialect model](dialects.md) explains interpretation; [Explorer navigation](../guides/explore-architecture.md#reveal-a-secondary-resource) explains why a represented resource may not have a permanent scene card.

Every active emission has a closure for its instance. `resolved` has a complete, nonempty fact set; `absent` is complete and empty; `indeterminate` is incomplete. A list can establish some facts while another element stays indeterminate. The reason tells the reader which proof is missing:

| Reason | What remains unsettled |
| --- | --- |
| `unknown_until_apply` | Terraform or OpenTofu has not evaluated the needed value yet |
| `sensitive` | A sensitivity mask prevents Rootform from using the value |
| `ambiguous_unknown` | An eligible candidate has an unknown identity, so a match is not unique |
| `uncomparable_candidate` | Candidate provider identity cannot be compared safely |
| `reference_ambiguous` | A verified traversal and evaluated value name different endpoints |
| `identity_incomplete` | A candidate lacks enough established identity to match |
| `unavailable` | The plan or state JSON does not provide the needed evidence |
| `external_denied` | No in-stage target matches and the Dialect forbids an external endpoint |
| `duplicate_identity` | More than one candidate has the same matching identity |

An indeterminate closure is not a proven omission. Its reason and candidate counts keep a partial result usable without claiming certainty.

## Accounting keeps partial knowledge honest

Architecture accounting counts observed instances, interpreted instances, established facts, and closure outcomes separately. It does not use an absent declaration as proof of zero instances unless the plan establishes a complete population. A represented instance with no matching Rule is counted as uninterpreted; a matched emission with unresolved evidence is counted as indeterminate. An instance present before the plan that the plan neither changes nor deletes remains in Planned with `carried` status, but the plan did not evaluate it and its population is unverified. Missing evidence for that instance cannot support a Policy pass or violation. These distinctions explain why a usable Form can contain gaps without treating them as empty architecture.

## Facts preserve bounded provenance

Every established fact cites the Rule, emission, closure, and evidence kind that justify it. `value` means evaluated plan or state values established the endpoint. `traversal` means a verified saved-plan identity traversal did. `both` means they agreed. Traversals are available only for a plan's `planned` stage; historical stages and state JSON use evaluated values. A verified saved plan can settle an endpoint whose planned value is unknown until apply, but it cannot make all unknown values known.

Provenance records architectural justification without embedding raw plan or state values. Use `rootform explain instance <address> --input <input>` to inspect an instance's facts, closures, dependencies, and diagnostics. The [explanation reference](../reference/cli/explain/instance.md) gives accepted inputs and flags.

## Comparisons and drift

One plan can contain Reported drift (`comparisons.drift`, Recorded to Refreshed), Planned changes (`comparisons.changes`, Refreshed to Planned), and Net change (`comparisons.net`, Recorded to Planned) when both stages in each pair exist. Drift that the plan reverts cancels out of Net change. The drift report preserves each reported drift record and classifies its architectural consequence; it is separate from the comparison. “No drift reported in this plan” means only that this plan contains no reported drift records; data sources and deposed objects are outside those records.

A comparison Form embeds two complete state or plan Forms under `before.form` and `after.form`, with each selected `stage` and `selected_from` (`input`, `before`, or `after`). It never embeds another comparison Form. Reopen it with `rootform run comparison.json`; a comparison Form is not a `--diff` operand. Its `cross` comparison shows Differences, never drift. `comparable` and `problems` say whether semantic selections support comparison; `indeterminate` preserves a closure whose change cannot be established. See [Comparisons](comparisons.md).

## Stable identity and canonical order remove noise

An instance Representation is identified by its address across stages. Move and replacement information from the plan is kept separately so a comparison can describe continuity. External endpoint ordinals are Form-local; cross-input comparison matches recorded identities, never ordinal alone. Canonical ordering and stable identities make repeated analysis with the same input and selection byte-identical. The canonical digest identifies serialized Form bytes, including generator version, not architectural equivalence. Two Forms can differ in bytes without a determined architectural change; semantic comparison answers that question separately.

## Valid partial Form differs from invalid Form

A valid Form can include uninterpreted instances, proven absence, and indeterminate closures. A structurally invalid one has a damaged contract: unsupported fields, broken references or identities, noncanonical order, or inconsistent closures. Rootform refuses it rather than silently ignoring a section. An invalid Form supports no compliance or no-change claim.

Do not hand-edit generated JSON. Use `rootform validate form <file>` before passing a saved Form to another consumer.

## Saved evidence still needs handling rules

Plan JSON, state JSON, and saved plans may contain secrets in clear text. Rootform reads them locally and keeps sensitive values out of Forms, text reports, SARIF, and the Explorer. A saved Form still contains resource addresses, names, Concepts, facts, and limited external identities. Review access and artifact retention before sharing it. A self-contained HTML export makes no network requests; the local Explorer server binds loopback only. See [Security](../security/index.md#protect-plans-and-derived-outputs).

<!-- docs-check:concept-document-save -->
```sh
rootform run plan.json --no-serve -o analysis.json
```

<!-- docs-check:concept-document-reopen -->
```sh
rootform run analysis.json --no-serve -o report.md
```

The first command writes a Form. The second reads its saved interpretation and writes a Markdown report without the original plan. If reopening fails, validate the saved Form before using it elsewhere. For a task walkthrough, [Explore a Form](../guides/explore-architecture.md) or [Compare two Forms](../guides/compare-architectures.md).
