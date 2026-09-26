---
title: "Forms and Rootform documents"
description: "Read stage-specific Forms, saved Rootform documents, and their evidence limits."
---

A Form is the architecture Rootform establishes from infrastructure evidence at a specific stage. A Form can be Recorded, Refreshed or Planned. It may be partial, and Rootform keeps uncertainty explicit. A Form is derived, never authored or edited.

A Rootform document is the saved JSON (format version `"1"`) of an analysis or an input comparison. An analysis includes everything Rootform derives from one input: its Forms, comparisons, drift report, evidence record, semantics, and diagnostics. Saved documents let you reopen a result without rereading the plan or state JSON. The [contract](../../contracts/rootform-document.md) and [JSON Schema](../../schemas/rootform-document.schema.json) define exact fields.

## The document captures its input and meaning

| `kind` | Input or operation | Contents |
| --- | --- | --- |
| `state` | State JSON | One Recorded Form (`recorded`) |
| `plan` | Plan JSON | Planned Form (`planned`), plus Refreshed and reconstructed Recorded Forms when prior state exists; comparisons and a drift report |
| `comparison` | `run` with `--diff` | Two embedded analyses and one selected input comparison |

A saved analysis keeps its `format_version`, `generator`, `evidence`, `semantics`, `forms`, diagnostics, and `default_stage`. `forms` is keyed by stage. `format_version: "1"` names the document contract; the binary version identifies the Rootform version that wrote it. The `semantics` section retains the exact vocabulary, Dialects, Rules, and emissions used for interpretation. Reopening it does not apply today's Dialects to yesterday's evidence.

The `evidence` section distinguishes what the plan or state JSON reports from claims supplied through flags. The input's `terraform_version` value is recorded verbatim; the tool stays `unestablished` unless `--producer` names Terraform or OpenTofu. Completeness records what the plan reports or what `--plan-complete=attested` explicitly claims. The `enrichment.snapshot` status is `verified`, `refused`, or `absent`: it says whether `--plan-file` paired the saved plan with the JSON export. Pairing checks identity and configuration shape, but is not a cryptographic origin proof.

## Stages and facts

A plan's Planned Form describes the proposed outcome. Refreshed describes prior state after Terraform or OpenTofu refresh when available. Recorded reconstructs state before drift reported in that plan and can be partial. A state JSON has only a Recorded Form. Rootform does not infer that a plan refreshed every resource; the JSON does not record its refresh scope.

Each Form records declarations and their population, per-instance Representations and interpretation, architectural facts, closures, dependencies, diagnostics, and accounting. Managed and data instances both get Representations. A Representation has an instance address, provider identity, status, and any applied Rule and Concept. A Rule-free instance stays represented. Dependency ledger entries do not become Relations by themselves. Forms carry no attribute values, only external identities a Dialect discloses.

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

Form accounting counts observed instances, interpreted instances, established facts, and closure outcomes separately. It does not use an absent declaration as proof of zero instances unless the plan establishes a complete population. A represented instance with no matching Rule is counted as uninterpreted; a matched emission with unresolved evidence is counted as indeterminate. These distinctions explain why a usable document can contain gaps without pretending they are empty architecture.

## Facts preserve bounded provenance

Every established fact cites the Rule, emission, closure, and evidence kind that justify it. `value` means evaluated plan or state values established the endpoint. `traversal` means a verified saved-plan identity traversal did. `both` means they agreed. Traversals are available only for a plan's `planned` stage; historical stages and state JSON use evaluated values. A verified saved plan can settle an endpoint whose planned value is unknown until apply, but it cannot make all unknown values known.

Provenance records architectural justification without embedding raw plan or state values. Use `rootform explain architecture` to inspect an instance's facts, closures, dependencies, and diagnostics. The [explanation reference](../reference/cli/explain/architecture.md) gives accepted inputs and flags.

## Comparisons and drift

One plan can contain Reported drift (`comparisons.drift`, Recorded to Refreshed), Planned changes (`comparisons.changes`, Refreshed to Planned), and Net change (`comparisons.net`, Recorded to Planned) when those Forms exist. Drift that the plan reverts cancels out of Net change. The drift report preserves each reported drift record and classifies its architectural consequence. “No drift reported in this plan” means only that this plan contains no reported drift records; data sources and deposed objects are outside those records.

An input comparison document embeds its `before` and `after` analyses and names selected stages in `comparison.before` and `comparison.after`. It shows differences, never drift. `comparable` and `problems` say whether semantic selections support comparison; `indeterminate` preserves a closure whose change cannot be established. See [Comparisons](comparisons.md).

## Stable identity and canonical order remove noise

An instance Representation is identified by its address across stages. Move and replacement information from the plan is kept separately so a comparison can describe continuity. External endpoint ordinals are document-local; input comparison matches recorded identities, never ordinal alone. Canonical ordering and stable identities make repeated analysis with the same input and selection byte-identical.

## Valid partial document differs from invalid document

A valid Rootform document can include uninterpreted instances, proven absence, and indeterminate closures. A structurally invalid one has a damaged contract: unsupported fields, broken references or identities, noncanonical order, or inconsistent closures. Rootform refuses it rather than silently ignoring a section. An invalid document supports no compliance or no-change claim.

Do not hand-edit generated JSON. Use `rootform validate document <document>` before passing a saved document to another consumer.

## Saved evidence still needs handling rules

Plan JSON, state JSON, and saved plans may contain secrets in clear text. Rootform reads them locally and keeps sensitive values out of documents, text reports, SARIF, and the Explorer. A Rootform document still contains resource addresses, names, Concepts, facts, and limited external identities. Review access and artifact retention before sharing it. A self-contained HTML export makes no network requests; the local Explorer server binds loopback only. See [Security](../security/index.md#protect-plans-and-derived-outputs).

<!-- docs-check:concept-document-save -->
```sh
rootform run plan.json --no-serve -o analysis.json
```

<!-- docs-check:concept-document-reopen -->
```sh
rootform run analysis.json --no-serve -o report.md
```

The first command writes a Rootform document. The second reads its saved interpretation and writes a Markdown report without the original plan. If reopening fails, validate the JSON document before using it elsewhere. For a task walkthrough, [explore an architecture](../guides/explore-architecture.md) or [compare architectures](../guides/compare-architectures.md).
