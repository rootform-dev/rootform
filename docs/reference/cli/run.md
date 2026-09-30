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

With `--diff <input>`, each operand is a plan, a state, or a saved
single-input Form; a comparison Form reopens alone and is never a `--diff`
operand. At most one operand may read standard input. A configuration
directory and a binary saved plan are not analysis inputs. `--project <dir>`
selects project Dialect content; it does not read that directory as
infrastructure evidence. See [Choose an input](../../inputs/index.md).

<!-- BEGIN GENERATED CLI: rootform run -->

## Usage

```text
rootform run <input> [--diff <input>] [options]
```

## Options

### Inputs and stages

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --after-stage ` | ` string ` | ` "" ` | stage of the second input to compare: `planned\|refreshed\|recorded`; default: Planned for a plan, Recorded for a state |
| ` --before-stage ` | ` string ` | ` "" ` | stage of the first input to compare: `planned\|refreshed\|recorded`; default: Planned for a plan, Recorded for a state |
| ` --diff ` | ` string ` | ` "" ` | compare with a second `input`: a plan, a state, or a saved single-input Form |
| ` --stage ` | ` string ` | ` "" ` | stage the summary leads with, for one input: `planned\|refreshed\|recorded`; default: Planned for a plan, Recorded for a state |

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --details ` | ` bool ` | ` false ` | add semantics, closure counts, and diagnostic codes; a Markdown summary and the summary beside the explorer then list every entry |
| ` --format ` | ` string ` | ` "" ` | format of standard output, or of a single -o file without a recognized extension: `text\|json\|markdown\|html`; default: text |
| ` -o, --output ` | ` stringArray ` | ` [] ` | write `file`; its extension selects the format: .json (the Form), .txt, .md, or .html; repeatable |

### Explorer

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --no-browser ` | ` bool ` | ` false ` | serve the explorer without opening a browser |
| ` --no-serve ` | ` bool ` | ` false ` | exit once the outputs are written instead of serving the explorer |
| ` --port ` | ` int ` | ` 21717 ` | serve the explorer on loopback `port`; 0 picks a free port; default: 21717 |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Advanced evidence settings

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --diff-plan-file ` | ` string ` | ` "" ` | pair the --diff plan JSON with its saved plan `file`, as --plan-file does |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; the only `value` is attested |
| ` --plan-file ` | ` string ` | ` "" ` | pair the plan JSON with the saved plan `file` it was exported from, to enrich it; pairing compares version, timestamp, and configuration shape |
| ` --producer ` | ` string ` | ` "" ` | declare the tool that produced the input: `terraform\|opentofu` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map an observed provider to a binding, as `observed=binding`; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse the input when its saved plan file does not pair with the plan JSON |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform run |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

## Examples

Analyze one plan, then save its Form:

<!-- docs-check:journey-run-save -->
```sh
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json
```

The summary goes to standard output, and `Wrote analysis.json` to standard
error. The status is `0`; a saved plan that fails verification exits `3`
because of `--require-enrichment`.
The [quickstart](../../getting-started/quickstart.md) reads the same summary
step by step.

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
watch files or replan. See [Explore a Form](../../guides/explore-architecture.md).

Repeat `-o` for a Form in JSON, a report in Markdown or text, or a
self-contained HTML Explorer. Each `-o` file takes its format from its
extension. Without `-o`, `--format` sets the format of standard output. When
exactly one `-o` file has an extension that names no format, `--format` sets
that file's format and standard output keeps the text summary; without
`--format`, that file is refused. `--format` is also refused when it
contradicts an extension or when more than one `-o` is given. `-o -` is
refused: standard output already carries the summary or the `--format`
output. See [Outputs and exit status](../outputs.md) for exact extensions,
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

Status `0` means the Form was produced or opened; `2` means the command was
used incorrectly; `3` means an input was refused, `rootform.lock` is invalid,
or a requested stage is unavailable; `4` means an input or output file, or the
explorer, failed. Architectural differences and reported drift do not by
themselves make the command fail. Read the exact
[output contract](../outputs.md#analysis-exit-status).
