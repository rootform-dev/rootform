---
title: "rootform run"
description: "Analyze a plan or state, reopen a saved Form, or compare two inputs."
---

`run` compiles one plan or state export into a Form, opens a saved Form, or
compares two accepted inputs. It detects their kind from content. A plan or
state export is analyzed with the active Dialects; a saved Form is
validated and loaded without reinterpretation.

## Accepted inputs

| Input | Form |
| --- | --- |
| Plan JSON from `show -json` on a saved plan | Planned stage, available earlier stages, drift and internal comparisons |
| State JSON from `show -json` | One Recorded stage |
| Saved Form | Its saved stages, facts, closures, and evidence |
| `-` | One of those JSON forms on standard input |

`--diff <input>` compares the first input with a second one. At most one
operand may read standard input. A configuration directory and a binary
saved plan are not analysis inputs. `--project <dir>` selects project
Dialect content; it does not read that directory as
infrastructure evidence. See [Choose an input](../../inputs/index.md).

<!-- BEGIN GENERATED CLI: rootform run -->

## Usage

```text
rootform run <input> [--diff <input>] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --after-side ` | ` string ` | ` "" ` | read `side` of a second comparison: before, after |
| ` --after-stage ` | ` string ` | ` "" ` | compare `stage` of the second input |
| ` --before-side ` | ` string ` | ` "" ` | read `side` of a first comparison: before, after |
| ` --before-stage ` | ` string ` | ` "" ` | compare `stage` of the first input |
| ` --dialect ` | ` stringArray ` | ` [] ` | use dialect source `dir`; repeatable |
| ` --diff ` | ` string ` | ` "" ` | compare with a second `input` |
| ` --diff-plan-file ` | ` string ` | ` "" ` | verify the second plan against saved plan `file` |
| ` --format ` | ` string ` | ` "" ` | `format` of standard output or of one -o file |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform run |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` --no-browser ` | ` bool ` | ` false ` | serve without opening a browser |
| ` --no-serve ` | ` bool ` | ` false ` | write the requested files and exit |
| ` -o, --output ` | ` stringArray ` | ` [] ` | write `file`, formatted by extension; repeatable |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; `value` must be attested |
| ` --plan-file ` | ` string ` | ` "" ` | verify the first plan against saved plan `file` |
| ` --port ` | ` int ` | ` 21717 ` | serve on `port`; 0 picks one |
| ` --producer ` | ` string ` | ` "" ` | declare the producing `tool`: terraform, opentofu |
| ` --project ` | ` string ` | ` "" ` | use the Dialects of project `dir` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map provider `pair` observed=binding; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse a saved plan file that does not verify |
| ` --stage ` | ` string ` | ` "" ` | report `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Examples

Analyze one plan, then save its Form:

<!-- docs-check:journey-run-save -->
```sh
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json
```

The summary goes to standard output, and `Wrote analysis.json` to
standard error. The status is `0`; a saved plan that fails verification
exits `3` because of `--require-enrichment`.
[Your first architecture](../../getting-started/first-architecture.md) reads
the same summary step by step.

Compare two plan exports and save a Markdown report:

<!-- docs-check:journey-run-compare -->
```sh
rootform run base/plan.json --plan-file base/plan.tfplan \
  --diff head/plan.json --diff-plan-file head/plan.tfplan \
  --no-serve -o comparison.md
```

The comparison summary goes to standard output and the full comparison to
`comparison.md`. Differences are not failures: the status is `0`.

`--stage` selects the reported stage of one input. With
`--diff`, use `--before-stage` and `--after-stage`; a missing or ambiguous
stage is refused with available choices. A plan defaults to `planned`;
a state defaults to `recorded`. The saved Form keeps every stage its input
supports, whatever stage the summary reports; `rootform check` chooses the
stage it evaluates on its own.

## Serve or export

By default, `run` starts a loopback-only server, opens a browser, and
stays in the foreground until interrupted. `--no-browser` leaves browser
launch to you. `--port 0` selects an available port. `--no-serve`
writes requested outputs and exits. The server analyzes once; it does not
watch files or replan. See [Explore an architecture](../../guides/explore-architecture.md).

Repeat `-o` for a Form in JSON, a report in Markdown or text, or a
self-contained HTML Explorer.
Each recognized extension selects its format. `--format` selects standard
output, or the format of one output file without a recognized extension.
See [Outputs and exit status](../outputs.md) for exact extensions,
stream separation, collision behavior, and status codes.

## Project selection

Embedded Dialects work without a lock. `--locked` requires a valid
`rootform.lock` for the selected project. `--dialect` selects local
Dialect sources for this analysis; an override cannot be combined with
`--locked`. `run` does not select or evaluate Policies. Use
`rootform check` for a separate Policy gate.

`--plan-file` verifies and enriches the first plan; `--diff-plan-file`
does the same for the second. `--require-enrichment` refuses a failed
pairing. `--producer`, `--provider-map`, and
`--plan-complete=attested` record operator claims rather than
facts established by the plan. See [plan inputs](../../inputs/plans.md).

## Exit status

Status `0` means analysis completed; `2` means incorrect command use;
`3` means input or analysis failed; `4` means an output could not be
written or the local server could not start. Architectural differences and
reported drift do not by themselves make the command fail. Read the exact
[output contract](../outputs.md#analysis-exit-status).
