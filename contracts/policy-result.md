# Policy result contract

Current format version: `1`.

`rootform check` evaluates selected Policies against a plan's Planned
architecture, a state's Recorded architecture, or both sides of a comparison
Form by default, and records one overall conclusion in a Policy result.
Evaluation consumes a validated Form and linked Policy Pack artifacts (or their
source, linked automatically and locally). It never re-reads Terraform, reloads
Dialects, accesses the network, recompiles locked source, writes
`rootform.lock`, or upgrades unresolved evidence. `rootform run` never selects,
links, or evaluates a Policy. Policy results are separate artifacts: they never
enter the Form, and evaluation never changes Form bytes.

Policies belong to Policy Packs, never to Dialects. A Dialect may not carry,
override, or append Policies; a Policy Pack may not change Dialect semantics.
Policy Pack selection is never automatic: evaluation uses only Policy Packs
recorded in the project lock or named explicitly for one invocation.

## Evaluated stage

The input is a plan JSON, a state JSON, a saved Form, or standard input. A plan
or state is compiled with the project's Dialects; a saved Form is validated and
read as it is, never compiled again. The default stage is Planned for a plan
Form and Recorded for a state Form. A comparison Form evaluates both Before and
After by default, each at the stage selected in the saved comparison for that
side.
`--side before` or `--side after` limits evaluation to one side; `--side both`
selects both explicitly. For a comparison Form, `--stage` selects another
stage of one side and requires `--side before` or `--side after`. A plan's
reconstructed Recorded stage is never evaluated. Comparisons, drift, and the
drift report are not architectures and are never evaluated. A stage the Form
does not hold stops the check with `STAGE_UNAVAILABLE`.

## Selection

The active set is the Policy Packs of `rootform.lock`, where a `--policy-pack`
overlay adds a Policy Pack or replaces the Policy Pack of the same name for one
invocation. Without `--policy`, every Policy of the overlay Policy Packs is
selected when overlays exist, and every Policy of every active Policy Pack
otherwise. `--policy` accepts `PACK/*`, `PACK/NAME`, `PACK.policy.NAME`, or a
unique `NAME`, and resolves against declared Policies before anything is
linked; an unknown or ambiguous
selector is a usage error. Only Policy Packs holding a selected Policy are
linked, whole, against the semantics recorded in the Form, and only selected
Policies are evaluated. Every other Policy Pack is reported by identity with
`linked: false` and never influences the verdict. A Policy Pack source that
fails to compile fails the check whatever the selection, because its Policies
cannot be known. An empty active set stops the check with `POLICY_UNAVAILABLE`.

## Targets and queries

A Policy target composes `concept`, `rules`, and `dialects` dimensions:
OR within each list, AND between dimensions; at least `concept` or `rules` is
required, and present lists are non-empty. `concept` examines the effectively
established classification; `rules` examines the effectively applied proper
Rule; `dialects` filters the owner of that interpretation. `rf` is not a
Dialect owner usable in `dialects`. A supporting member never inherits its
root's eligibility.

A base without Rule or Concept is not selected by these targets. A Rule-target
is satisfied only by Representations to which that Rule is actually applied;
no fallback to type or provider exists. A Concept-only target never fails for
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

Cardinality counts distinct contributing Representations, not emissions or
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

The result has one overall status. A violation on either evaluated side takes
precedence over uncertainty on the other:

| Status | Meaning | Exit |
| --- | --- | --- |
| `passed` | every selected Policy passed with complete coverage | `0` |
| `violated` | a selected Policy is violated, even beside indeterminate ones | `1` |
| `indeterminate` | the evidence cannot decide a selected Policy | `3` |
| `no_decision` | no Policy is selected, or a selected Policy has no target | `3` |
| `failed` | evaluation could not run, for example a selected Policy Pack cannot link | `3` |

A `no_target` Policy is never counted as passed: a vacuous pass is not a
demonstrated conclusion, and `passed` never implies universal infrastructure
inventory compliance. Exit `2` means invalid usage, including an unknown or
ambiguous selector. Exit `4` means an input or report file could not be read or
written. Standard output states the verdict once, in the summary or in the
`--format` output. Standard error carries progress and names a code when the
check stops before evaluating, such as `STAGE_UNAVAILABLE` or
`POLICY_UNAVAILABLE`, or when a report cannot be written (`OUTPUT_FAILED`). No
internal error exits `0` or `1`.

## Explanation

`rootform explain policy` reads a result and never evaluates again. It states
the Requirement from the recorded message, assertion, and target, then each
evaluation's recorded evidence and conclusion. An evaluation records which
facts and closures it inspected, not what they hold: with `--input` naming the
Form whose digest the result records, the explanation shows their outcome;
without it, the explanation says which evidence it cannot describe and how to
pass that Form.

## Result document

A Policy result is a JSON object with these top-level members:

| Member | Content |
| --- | --- |
| `format_version` | `"1"` |
| `form_format_version` | Form format the result was computed from |
| `generator` | name and version of the evaluating Rootform |
| `form` | received Form: `kind`, `origin` (`compiled` or `saved`), `digest`, `generator`; absent when the check stopped before reading it |
| `scope` | `input`, `before`, `after`, or `both`; absent when the check stopped before choosing what to evaluate |
| `selection` | the `selectors` given and the selected Policy IDs |
| `architectures` | one entry per evaluated architecture, ordered Before then After for a comparison |
| `status` | one overall status from the table above |
| `diagnostics` | ordered, sanitized invocation diagnostics with their code |

Each `architectures` entry contains `kind`, `stage`, `digest`, and `side` for
a comparison. It also contains:

| Member | Content |
| --- | --- |
| `status` | conclusion for this architecture |
| `release_set`, `semantic_owners` | exact semantic identity recorded in this input Form |
| `policy_packs` | every loaded Pack: `id`, `version`, `content_digest`, `linked`, and for a linked Pack `linked_digest` and `pins` |
| `summary` | `policies` (selected, passed, violated, indeterminate, no_target) and `evaluations` (total, passed, violated, indeterminate) |
| `policies` | one entry per selected Policy: message, `assertion` in canonical expression syntax, target definition, target count, coverage, reasons, outcome |
| `evaluations` | one entry per instance evaluation: Policy, target, address, Rule, Concept, stage, outcome, reasons, inspected facts and closures |
| `violations` | the violated evaluations with their message and inspected facts |
| `diagnostics` | ordered, sanitized diagnostics for this architecture |

`digest` values are `sha256:` digests of the canonical Form serialization; for
a Form saved by Rootform, `form.digest` equals the digest of the file. In a
comparison result, each architecture's digest identifies its embedded Form.
A saved Form and the plan it was compiled from reach the same conclusions; only
`form.origin` differs. A result identifies each Policy by an identity that
names its Policy Pack and never embeds Form content beyond identities, raw plan
or state content, or a sensitive value. Exact Policy Pack source and
acquisition pins remain in `rootform.lock`. A result is valid only for the
Form semantics and Policy Pack selection it records.

## Reports

`check` writes `text`, `json` (the Policy result), `markdown`, and `sarif`.
Each `-o` file takes its format from its extension: `.txt`, `.json`, `.md`,
`.sarif`, or `.sarif.json`. Without `-o`, `--format` sets the format of
standard output. When exactly one `-o` file has an extension that names no
format, `--format` sets that file's format and standard output keeps the text
summary; without `--format`, that file is a usage error. `--format` is also a
usage error when it contradicts an extension or when more than one `-o` is
given. `-o -` is a usage error: standard output already carries the summary or
the `--format` output. `.html` names a Form's interactive export and is a
usage error even with `--format`; `rootform run` writes it.
Output paths are validated before any other option; from then on, every
failure, usage errors included, writes a `failed` result to every requested
output, so no earlier report can pass for the invocation. Every report is
rendered from one result before any is written, each file is written
atomically, and reports are written whatever the verdict. Standard output
carries the text summary or the `--format` output; standard error carries
progress and diagnostics. JSON and SARIF carry no terminal styling.

## SARIF

SARIF is a presentation of the same result; it changes neither evaluation
meaning nor exit status. A log is SARIF 2.1.0 with one run per evaluated
architecture. Each run has:

- one rule per selected Policy, identified `PACK/NAME`, with its message as
  short description and the full Policy ID in `properties.policy`;
- one result per instance evaluation: `passed` is kind `pass`, level `none`;
  `violated` is kind `fail`, level `error`; `indeterminate` is kind
  `review`, level `none`, since SARIF requires level `none` for any kind other
  than `fail`;
- a logical location naming the address; no file or line is fabricated;
- a `rootformEvaluation/v1` partial fingerprint carrying the evaluation ID, and
  the stage, address, target, and reasons in result properties;
- the architecture status, overall status, Form and evaluated identities,
  scope, selection, and architecture summary in run properties;
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
