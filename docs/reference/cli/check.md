---
title: "rootform check"
description: "Evaluate selected Policies against a Form's architectures and exit with one verdict."
---

`check` is the Policy gate. It evaluates selected Policies against a plan's
Planned architecture, a state's Recorded architecture, or both sides of a
comparison Form by default, then exits with one verdict. The input is a
plan or state export, compiled with the project's Dialects, or a saved Form,
loaded without compiling it again. `check` never serves, never changes the
Form, and writes a Policy result that is separate from the Form.

<!-- BEGIN GENERATED CLI: rootform check -->

## Usage

```text
rootform check <input> [options]
```

## Options

### Target selection

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --side ` | ` string ` | ` "" ` | sides of a comparison Form to evaluate: `before\|after\|both`; default: both |
| ` --stage ` | ` string ` | ` "" ` | stage to evaluate: `planned\|refreshed\|recorded`; default: Planned for a plan, Recorded for a state; with a comparison Form, needs --side before or after |

### Policy selection

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --policy ` | ` stringArray ` | ` [] ` | evaluate only the Policies `selector` names: PACK.policy.NAME, PACK/NAME, a bare name, or PACK/*; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | add or replace the Policy Pack at `path`, a source directory or a compiled file, for this command only; repeatable |

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --details ` | ` bool ` | ` false ` | also list passed evaluations, Policy Pack identities, and diagnostic codes |
| ` --format ` | ` string ` | ` "" ` | format of standard output, or of a single -o file without a recognized extension: `text\|json\|markdown\|sarif`; default: text |
| ` -o, --output ` | ` stringArray ` | ` [] ` | write `file`; its extension selects the format: .json (the Policy result), .txt, .md, .sarif, or .sarif.json; repeatable |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Advanced evidence settings

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; the only `value` is attested |
| ` --plan-file ` | ` string ` | ` "" ` | pair the plan JSON with the saved plan `file` it was exported from, to enrich it; pairing compares version, timestamp, and configuration shape |
| ` --producer ` | ` string ` | ` "" ` | declare the tool that produced the input: `terraform\|opentofu` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map an observed provider to a binding, as `observed=binding`; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse the input when its saved plan file does not pair with the plan JSON |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform check |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

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
Policy check completed

Input          analysis.json
Origin         Plan (saved Form)
Stage          Planned
Policies       2 selected

Evaluations    2
Passed         2
Violated       0
Indeterminate  0

Verdict        PASSED

All selected evaluations passed.
```

`Loading    analysis.json (saved Form; no recompilation)` on standard error
confirms that the saved Form was evaluated as written. `results.json` is the
Policy result, `report.md` the review report, and `results.sarif` a SARIF
2.1.0 log. Each report is written whatever the verdict.

## Choose the evaluated stage

A plan is checked on Planned and a state on Recorded. A comparison Form is
checked on both Before and After by default, each at the stage selected in the
saved comparison for that side. `--side before` or `--side after` limits the check to
one side; `--side both` names the default. `--stage` selects another stage of
the input, or of the one side a comparison check names with `--side before` or
`--side after`: `refreshed` when the plan has one, never a plan's
reconstructed `recorded` stage. An absent stage stops the check with
`STAGE_UNAVAILABLE`; Rootform never falls back to another stage. Comparisons,
drift, and the drift report are never evaluated as architectures.

## Select Policies

The active Policy Packs come from `rootform.lock`. `--policy-pack` adds or
replaces one pack for this command without changing the lock, and `--locked`
refuses it. Without `--policy`, `check` selects every Policy of the
`--policy-pack` packs, or every Policy of every active pack when none is
given. Each `--policy` selector (`PACK/*`, `PACK/NAME`, `PACK.policy.NAME`,
or a unique `NAME`) narrows that selection before anything is linked; an
unknown or ambiguous selector exits `2`. Only packs holding a selected Policy
are linked, against the semantics recorded in the Form.
Reports name each Policy by the identity `list` and `show` print,
`PACK.policy.NAME`; SARIF rule IDs keep `PACK/NAME`. A violation or an
indeterminate evaluation lists the Policy, the resource, the Requirement the
Policy declares, and the recorded Evidence that decided it.

## Reports

Each `-o` file takes its format from its extension: `.json` for the Policy
result, `.md` or `.txt` for a report, and `.sarif` or `.sarif.json` for
SARIF. Without `-o`, `--format` sets the format of standard output. When
exactly one `-o` file has an extension that names no format, `--format` sets
that file's format and standard output keeps the text summary; without
`--format`, that file is refused. `--format` is also refused when it
contradicts an extension or when more than one `-o` is given. `-o -` is
refused: standard output already carries the summary or the `--format`
output. `.html` is refused even with `--format`: the interactive export
belongs to `rootform run`. Every report is rendered from one result before any
file is written. Once output paths are validated, a check that stops writes a
`failed` result to every requested file, so an earlier report never passes for
this invocation. See
[Outputs and exit status](../outputs.md) for the formats.

## Exit status

| Exit | Meaning |
| --- | --- |
| `0` | Every selected Policy passed on every requested side. |
| `1` | A selected Policy was violated on a requested side. |
| `2` | The command was used incorrectly. |
| `3` | No verdict: indeterminate, no target, nothing selected, a side that could not be evaluated, an input that was refused, or an invalid `rootform.lock`. |
| `4` | An input or report file could not be read or written. |

A violation takes precedence over indeterminate results. Standard output
states the verdict once, in the summary or in the `--format` output. Standard
error carries progress, plus a code when the check stops before evaluating,
such as `STAGE_UNAVAILABLE` or `POLICY_UNAVAILABLE`, or when a report cannot
be written (`OUTPUT_FAILED`).
[Follow a Policy through every outcome](../../guides/check-architecture.md) walks through each
outcome, and [Policies and Policy Packs](../../concepts/policies.md) explains
what a result proves.
