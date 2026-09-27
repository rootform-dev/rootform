---
title: "rootform check"
description: "Evaluate selected Policies against one stage of a Form and exit with the verdict."
---

`check` is the Policy gate. It evaluates the selected Policies against one
architecture stage within a Form and exits with the verdict. The input is a
plan or state export, compiled with the project's Dialects, or a saved Form,
loaded without compiling it again. `check` never serves, never changes the
Form, and writes a Policy result that is separate from the Form.

<!-- BEGIN GENERATED CLI: rootform check -->

## Usage

```text
rootform check <input> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --format ` | ` string ` | ` "" ` | `format` of standard output when no file is written |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform check |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` -o, --output ` | ` stringArray ` | ` [] ` | write `file`, formatted by extension; repeatable |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; `value` must be attested |
| ` --plan-file ` | ` string ` | ` "" ` | verify the plan against saved plan `file` |
| ` --policy ` | ` stringArray ` | ` [] ` | evaluate only `policy`; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |
| ` --producer ` | ` string ` | ` "" ` | declare the producing `tool`: terraform, opentofu |
| ` --project ` | ` string ` | ` "" ` | use the Dialects and Policy Packs of project `dir` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map provider `pair` observed=binding; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse a saved plan file that does not verify |
| ` --side ` | ` string ` | ` "" ` | evaluate `side` of a comparison Form: before, after |
| ` --stage ` | ` string ` | ` "" ` | evaluate `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Example

From a checkout of the repository, save the reviewed commerce plan as a Form,
then check it against the example Policy Pack and keep every report:

<!-- docs-check:cli-check -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform check analysis.json --policy-pack policy-packs/baseline \
  -o results.json -o report.md -o results.sarif
```

<!-- docs-output:cli-check -->
```text title="Check summary"
Policies passed
Evaluated     Planned architecture (default)
Policy Packs  baseline 0.1.0
Policies      2 policies selected: 2 passed
Evaluations   2 instances: 2 passed

Passed
  ✓ baseline/cluster-network-context  1 instance
  ✓ baseline/managed-database-network-context  1 instance
```

`Loading    analysis.json (saved Form; no recompilation)` on standard error
confirms that the saved Form was evaluated as written. `results.json` is the
Policy result, `report.md` the review report, and `results.sarif` a SARIF
2.1.0 log. Each report is written whatever the verdict.

## Choose the evaluated stage

A plan is checked on Planned and a state on Recorded. A comparison Form is
checked on its After side at the stage that side records; `--side before`
selects the other side. `--stage` selects another stage within the selected
Form: `refreshed` when the plan has one, never a plan's reconstructed
`recorded` stage. An absent stage stops the check with `STAGE_UNAVAILABLE`
and lists the available stages; Rootform never falls back to another stage.
Comparisons, drift, and the drift report are never evaluated as architectures.

## Select Policies

The active Policy Packs come from `rootform.lock`. `--policy-pack` adds or
replaces one pack for this command without changing the lock, and `--locked`
refuses it. Without `--policy`, `check` selects every Policy of the
`--policy-pack` packs, or every Policy of every active pack when none is
given. Each `--policy` selector (`PACK/*`, `PACK/NAME`, `PACK.policy.NAME`,
or a unique `NAME`) narrows that selection before anything is linked; an
unknown or ambiguous selector exits `2`. Only packs holding a selected Policy
are linked, against the semantics recorded in the Form.

## Reports

Each `-o` file takes its format from its extension: `.json` for the Policy
result, `.md` or `.txt` for a report, and `.sarif` or `.sarif.json` for
SARIF. An unknown extension is refused. `--format` chooses the format of
standard output only when no file is written. Every report is rendered from
one result before any file is written. Once the output paths are validated, a
check that stops writes a `failed` result to every requested file, so an
earlier report never passes for this invocation. See
[Outputs and exit status](../outputs.md) for the formats.

## Exit status

| Exit | Meaning |
| --- | --- |
| `0` | Every selected Policy was evaluated and passed. |
| `1` | A selected Policy was violated. |
| `2` | Incorrect command use. |
| `3` | No verdict: indeterminate evidence, a Policy with no target, nothing selected, or a failure. |
| `4` | A report could not be written after the verdict was stated. |

A violation takes precedence over indeterminate results. A nonzero verdict is
also stated on standard error with its code, such as `POLICY_VIOLATED` or
`POLICY_NO_DECISION`. [Check an architecture](../../guides/check-architecture.md)
walks through each outcome, and
[Policies and Policy Packs](../../concepts/policies.md) explains what a result
proves.
