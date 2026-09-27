# Policy Result contract

Current format version: `1`.

`rootform check` evaluates the selected Policies against one architecture stage
within a Form and records its conclusion in a Policy result. Evaluation consumes
a validated Form and linked Policy Pack artifacts (or their source, linked
automatically and locally). It never re-reads Terraform, reloads Dialects,
accesses the network, recompiles locked source, writes `rootform.lock`, or
upgrades unresolved evidence. `rootform run` never selects, links, or evaluates
a Policy. Policy results are separate artifacts: they never enter the Form, and
evaluation never changes Form bytes.

Policies belong to policy packs, never to dialects. A dialect may not carry,
override, or append policy; a policy pack may not change dialect semantics.
Pack selection is never automatic: evaluation uses only packs recorded in the
project lock or named explicitly for one invocation.

## Evaluated stage

The input is a plan JSON, a state JSON, a saved Form, or standard input. A plan
or state is compiled with the project's Dialects; a saved Form is validated and
read as it is, never compiled again. The default stage is Planned for a plan
Form, Recorded for a state Form, and, for a comparison Form, the After side at
the stage the comparison records for that side. `--side` selects the other side
of a comparison; `--stage` selects another stage of the selected Form. A plan's
reconstructed Recorded stage is never evaluated. Comparisons, drift, and the
drift report are not architectures and are never evaluated. A stage the Form
does not hold stops the check with `STAGE_UNAVAILABLE`.

## Selection

The active set is the Policy Packs of `rootform.lock`, where a `--policy-pack`
overlay adds a pack or replaces the pack of the same name for one invocation.
Without `--policy`, every Policy of the overlay packs is selected when overlays
exist, and every Policy of every active pack otherwise. `--policy` accepts
`PACK/*`, `PACK/NAME`, `PACK.policy.NAME`, or a unique `NAME`, and resolves
against declared Policies before anything is linked; an unknown or ambiguous
selector is a usage error. Only packs holding a selected Policy are linked,
whole, against the semantics recorded in the Form, and only selected Policies
are evaluated. Every other pack is reported by identity with `linked: false`
and never influences the verdict. A pack source that fails to compile fails
the check whatever the selection, because its Policies cannot be known. An
empty active set stops the check with `POLICY_UNAVAILABLE`.

## Targets and queries

A Policy target composes `concept`, `rules`, and `dialects` dimensions:
OR within each list, AND between dimensions; at least `concept` or `rules` is
required, and present lists are non-empty. `concept` examines the effectively
established classification; `rules` examines the effectively applied proper
Rule; `dialects` filters the owner of that interpretation. `rf` is not a
dialect owner usable in `dialects`. A supporting member never inherits its
root's eligibility.

A base without Rule or Concept is not selected by these targets. A Rule-target
is satisfied only by representations to which that Rule is actually applied;
no fallback to type or provider exists. A concept-only target never fails for
lacking a producer: the symbol must exist, and a Policy with zero targets in
the evaluated stage has outcome `no_target`.

Query signatures are:

```text
contexts(dimension[, target])
relations(predicate[, target])
contributions(contributor)
```

Targets are typed Concept or Rule references. Queries return deduplicated fact
IDs plus `supported` and `complete`. Support exists when at least one active
emission contract is compatible with the evaluated target. Completeness
requires the relevant contributor population to be determined and all their
active emissions closed; a source or interpretation uncertainty that could hide
a relevant contributor prevents a complete zero.

The plan settles neither a carried nor a deferred instance. An evaluation whose
target, inspected facts at either endpoint, or inspected closures depend on one
is indeterminate with reason `population_unverified`, and a declaration holding
a deferred instance counts as an unverified population.

Cardinality counts distinct contributing representations, not emissions or
composition members. `length(q)` is known only when both flags are true.
`exists(q)` is true with any confirmed fact, false only for a supported
complete zero, and indeterminate otherwise. Negation and boolean operators
follow three-valued logic. A Rule-free base provides no emission contract; its
absence of facts creates neither support, omission, nor proven zero.

## Outcomes

Each instance evaluation is `passed`, `violated`, or `indeterminate`, with the
reasons of an indeterminate outcome. Each selected Policy has one outcome:
`violated` when one of its evaluations is violated; otherwise `indeterminate`
when one is indeterminate or its coverage is incomplete; otherwise `no_target`
when it has no target; otherwise `passed`.

The result has one status:

| Status | Meaning | Exit |
| --- | --- | --- |
| `passed` | every selected Policy passed with complete coverage | `0` |
| `violated` | a selected Policy is violated, even beside indeterminate ones | `1` |
| `indeterminate` | the evidence cannot decide a selected Policy | `3` |
| `no_decision` | no Policy is selected, or a selected Policy has no target | `3` |
| `failed` | evaluation could not run, for example a selected pack cannot link | `3` |

A `no_target` Policy is never counted as passed: a vacuous pass is not a
demonstrated conclusion, and `passed` never implies universal infrastructure
inventory compliance. Exit `2` means invalid usage, including an unknown or
ambiguous selector. Exit `4` means a requested report could not be written;
the verdict is stated on standard error first. A check that stops before
evaluating exits `3` and names its own code, such as `STAGE_UNAVAILABLE` or
`POLICY_UNAVAILABLE`. No internal error exits `0` or `1`.

## Result document

A Policy result is a JSON object with these members:

| Member | Content |
| --- | --- |
| `format_version` | `"1"` |
| `form_format_version` | Form format the result was computed from |
| `generator` | name and version of the evaluating Rootform |
| `form` | received Form: `kind`, `origin` (`compiled` or `saved`), `digest`, `generator` |
| `evaluated` | evaluated architecture: `side` for a comparison, `kind`, `stage`, `digest` |
| `release_set`, `semantic_owners` | exact semantic identity recorded in the Form |
| `policy_packs` | every loaded pack: `id`, `version`, `content_digest`, `linked`, and for a linked pack `linked_digest` and `pins` |
| `selection` | the `selectors` given and the selected Policy IDs |
| `status` | the status above |
| `summary` | `policies` (selected, passed, violated, indeterminate, no_target) and `evaluations` (total, passed, violated, indeterminate) |
| `policies` | one entry per selected Policy: target definition, target count, coverage, reasons, outcome |
| `evaluations` | one entry per instance evaluation: Policy, target, address, rule, concept, stage, outcome, reasons, inspected facts and closures |
| `violations` | the violated evaluations with their message and inspected facts |
| `diagnostics` | ordered, sanitized diagnostics with their code |

`digest` values are `sha256:` digests of the canonical Form serialization; for
a Form saved by Rootform, `form.digest` equals the digest of the file. A saved
Form and the plan it was compiled from reach the same conclusions; only
`form.origin` differs. A result identifies each Policy by its pack-qualified
identity and never embeds Form content beyond identities, raw plan or state
content, or a sensitive value. Exact pack source and acquisition pins remain in
`rootform.lock`. A result is valid only for the Form semantics and pack
selection it records.

## Reports

`check` writes `text`, `json` (the Policy result), `markdown`, and `sarif`.
Each `-o` file takes its format from its extension: `.txt`, `.json`, `.md`,
`.sarif`, or `.sarif.json`. Any other extension, including `.html`, is a usage
error; `--format` names the format of standard output when no file is written.
Output paths are validated before any other option; from then on, every
failure, usage errors included, writes a `failed` result to every requested
output, so no earlier report can pass for the invocation. Every report is
rendered from one result before any is written, each file is written
atomically, and reports are written whatever the verdict. Standard output
carries the text summary or the `--format` output; standard error carries
progress and diagnostics. JSON and SARIF carry no terminal styling.

## SARIF

SARIF is a presentation of the same result; it changes neither evaluation
meaning nor exit status. A log is SARIF 2.1.0 with one run:

- one rule per selected Policy, identified `PACK/NAME`, with its message as
  short description and the full Policy ID in `properties.policy`;
- one result per instance evaluation: `passed` is kind `pass`, level `none`;
  `violated` is kind `fail`, level `error`; `indeterminate` is kind
  `review`, level `none`, since SARIF requires level `none` for any kind other
  than `fail`;
- a logical location naming the address; no file or line is fabricated;
- a `rootformEvaluation/v1` partial fingerprint carrying the evaluation ID, and
  the stage, address, target, and reasons in result properties;
- the status, Form and evaluated identities, selection, and summary in run
  properties;
- an execution failure as a `toolExecutionNotifications` entry naming the
  code, with `executionSuccessful` false.

Form diagnostics are not results. Ingestion by a code-scanning service is not
tested; the logical locations may not map to repository files, so keep the log
as a build artifact.

## Linking

Explicitly provided linked artifacts are replayed strictly: mismatch of
format, contract, or pins against the evaluated Form is a terminal refusal with
no fallback and no relink. In the source path, evaluation derives pins from the
Form's semantics, links deterministically and locally on cache miss, validates,
caches, and evaluates; a compatible evolution of a pinned unit triggers a new
local link without prompt or network. Linked cache state never changes the
verdict, semantic evidence, or linked digest. See
[`policy-pack-distribution.md`](policy-pack-distribution.md) and
[`../docs/offline-security.md`](../docs/offline-security.md).
