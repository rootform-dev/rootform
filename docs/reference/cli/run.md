---
title: "rootform run"
description: "Analyze a plan or state, reopen a saved document, or compare two inputs."
---

`run` accepts plan JSON, state JSON, a saved Rootform document, or `-` for standard input. It uses the project Dialects and selected policies. `--project` chooses project content; a configuration directory is not an analysis input. Rootform never runs Terraform or OpenTofu.

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
| ` --policy ` | ` stringArray ` | ` [] ` | evaluate only `policy`; repeatable |
| ` --policy-pack ` | ` stringArray ` | ` [] ` | select local Policy Pack `dir`; repeatable |
| ` --port ` | ` int ` | ` 21717 ` | serve on `port`; 0 picks one |
| ` --producer ` | ` string ` | ` "" ` | declare the producing `tool`: terraform, opentofu |
| ` --project ` | ` string ` | ` "" ` | use the Dialects and policies of project `dir` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map provider `pair` observed=binding; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse a saved plan file that does not verify |
| ` --stage ` | ` string ` | ` "" ` | report `stage`: planned, refreshed or recorded |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Examples

```sh
rootform run plan.json
rootform run plan.json --plan-file plan.tfplan --require-enrichment --no-serve -o analysis.json
rootform run state.json --no-serve -o snapshot.json
rootform run before.json --diff after.json --no-serve -o comparison.json
```

By default, `run` serves a loopback browser view until interrupted. `--no-browser` serves without opening a browser; `--no-serve` writes outputs and exits. A `-o` file's extension selects JSON, Markdown, text, SARIF, or standalone HTML. A plan can expose planned, refreshed, and recorded stages; a state has only recorded. `--diff` creates a cross-input comparison, never a drift report.

Exit status is `0` for successful analysis and passing selected policies, `1` for a policy violation, `2` for usage error, `3` for refused input or indeterminate/no policy decision, and `4` for export or server failure. See [Outputs and exit status](../outputs.md).
