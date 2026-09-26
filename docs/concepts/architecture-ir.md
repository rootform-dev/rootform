---
title: "Architecture documents"
description: "Read Rootform snapshot, plan, and comparison documents and their evidence limits."
---

A Rootform document is saved JSON that preserves enough architecture to reopen a result, explain a fact, compare stages or revisions, and evaluate selected Policies without rereading the plan or state JSON. Architecture IR is the name of the data contract behind that document. The [contract](../../contracts/architecture-ir.md) and [JSON Schema](../../schemas/architecture-ir.schema.json) define exact fields.

## The document captures its input and meaning

| `kind` | Input or operation | Contents |
| --- | --- | --- |
| `snapshot` | State JSON | One `recorded` stage |
| `plan` | Plan JSON | `planned`, and any supported `refreshed` and reconstructed `recorded` stages; internal comparisons and a drift report |
| `comparison` | `run` with `--diff` | Two embedded analysis documents and one selected cross-input comparison |

A saved document keeps its `format_version`, `generator`, `evidence`, `semantics`, stages, diagnostics, and default stage. `format_version: "1"` names the document contract; the binary version identifies the Rootform version that wrote it. The `semantics` section retains the exact vocabulary, Dialects, Rules, and emissions used for interpretation. Reopening it does not apply today's Dialects to yesterday's evidence.

The `evidence` section distinguishes what the plan or state JSON reports from claims supplied through flags. The input's `terraform_version` value is recorded verbatim; the tool stays `unestablished` unless `--producer` names Terraform or OpenTofu. Completeness records what the plan reports or what `--plan-complete=attested` explicitly claims. The `enrichment.snapshot` status is `verified`, `refused`, or `absent`: it says whether `--plan-file` paired the saved plan with the JSON export. Pairing checks identity and configuration shape, but is not a cryptographic origin proof.

## Stages and facts

A plan's `planned` stage describes the proposed outcome. `refreshed` describes prior state after Terraform or OpenTofu refresh when available. `recorded` reconstructs state before drift reported in that plan and can be partial. A state JSON has only `recorded`. Rootform does not infer that a plan refreshed every resource; the JSON does not record its refresh scope.

Each stage records declarations and their population, per-instance Representations and interpretation, architectural facts, closures, dependencies, diagnostics, and accounting. Managed and data instances both get Representations. A Representation has an instance address, provider identity, status, and any applied Rule and Concept. A Rule-free instance stays represented. Dependency ledger entries do not become Relations by themselves.

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

Stage accounting counts observed instances, interpreted instances, established facts, and closure outcomes separately. It does not use an absent declaration as proof of zero instances unless the plan establishes a complete population. A represented instance with no matching Rule is counted as uninterpreted; a matched emission with unresolved evidence is counted as indeterminate. These distinctions explain why a usable document can contain gaps without pretending they are empty architecture.

## Facts preserve bounded provenance

Every established fact cites the Rule, emission, closure, and evidence kind that justify it. `value` means evaluated plan or state values established the endpoint. `traversal` means a verified saved-plan identity traversal did. `both` means they agreed. Traversals are available only for a plan's `planned` stage; historical stages and state JSON use evaluated values. A verified saved plan can settle an endpoint whose planned value is unknown until apply, but it cannot make all unknown values known.

Provenance records architectural justification without embedding raw plan or state values. Use `rootform explain architecture` to inspect an instance's facts, closures, dependencies, and diagnostics. The [explanation reference](../reference/cli/explain/architecture.md) gives accepted inputs and flags.

## Comparisons and drift

One plan can contain `drift` (`recorded` to `refreshed`), `planned` (`refreshed` to `planned`), and `net` (`recorded` to `planned`) comparisons when those stages exist. The drift report preserves each reported drift record and classifies its architectural consequence. “No drift reported in this plan” means only that this plan contains no reported drift records; data sources and deposed objects are outside those records.

A `comparison` document embeds its `before` and `after` analysis documents and names selected stages in `comparison.before` and `comparison.after`. It is a cross-input result, never a drift report. `comparable` and `problems` say whether semantic selections support comparison; `undetermined` preserves a closure whose change cannot be established. See [Architecture comparisons](diff.md).

## Stable identity and canonical order remove noise

An instance Representation is identified by its address across stages. Move and replacement information from the plan is kept separately so a comparison can describe continuity. External endpoint ordinals are document-local; cross-input comparison matches recorded identities, never ordinal alone. Canonical ordering and stable identities make repeated analysis with the same input and selection byte-identical.

## Valid partial document differs from invalid document

A valid Rootform document can include uninterpreted instances, proven absence, and indeterminate closures. A structurally invalid one has a damaged contract: unsupported fields, broken references or identities, noncanonical order, or inconsistent closures. Rootform refuses it rather than silently ignoring a section. An invalid document supports no compliance or no-change claim.

Do not hand-edit generated JSON. Use [Validate an architecture](../reference/cli/validate/architecture.md) before passing a saved document to another consumer.

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
