---
title: "rootform build"
description: "Compile Terraform or OpenTofu into a deterministic architecture file or self-contained HTML."
---

Build an architecture from a Terraform/OpenTofu directory or a JSON plan.
Write canonical JSON for another command, or self-contained HTML for a browser.

## Input and defaults

With no directory, `build` reads current directory. It uses embedded Dialects plus exact project selection. It performs no discovery, acquisition,
prompt, or lock mutation. Use `--plan` for JSON plan; `-` reads standard input.

The default output format is `json`. The result goes to standard output unless
`--output` names a file. Preparation, diagnostics, and declaration counts go
to standard error. `build` does not evaluate Policy Packs.

<!-- BEGIN GENERATED CLI: rootform build -->

## Usage

```text
rootform build [directory] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use a dialect source `dir` for this run; repeatable |
| ` --format ` | ` string ` | ` json ` | write `format` (json/html) |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform build |
| ` --locked ` | ` bool ` | ` false ` | require an existing valid rootform.lock |
| ` -o, --output ` | ` string ` | ` "" ` | write the architecture to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; use `-` for standard input |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

> [!NOTE]
> `--locked` requires an existing valid `rootform.lock`. Prepare missing exact
> OCI pins first with `rootform init --locked` or vendor them with `rootform vendor`.

`--dialect <dir>` overlays one Dialect owner for this invocation and can be
repeated for different owners. It does not change `rootform.lock`; `--locked`
rejects overrides.

## Save an architecture

From a project using only embedded Dialects:

<!-- rootform:tabs Output format -->
<!-- rootform:tab JSON -->

<!-- docs-check:docs-reference-cli-build-1 -->
```sh
rootform build . --output architecture.json
```

The output file contains architecture facts and their provenance, not the raw
Terraform configuration.

<!-- rootform:tab HTML -->

### Export HTML

<!-- docs-check:docs-reference-cli-build-2 -->
```sh
rootform build . --format html --output architecture.html
```

Open file in browser. It contains its own renderer assets and needs no server
or sibling file.

<!-- rootform:endtabs -->

For the [VPC and subnet example](../../getting-started/first-architecture.md),
the declaration summary on standard error is:

```ansi title="Declaration summary"
[1m[32mArchitecture built -> architecture.json[0m

[2mResources[0m  2
[2mFacts[0m      1 resolved, 0 omitted
```

The resulting architecture retains resource bases and applied Rules for both
declarations. The summary is diagnostic context, not a separate output file.

## Read a plan

<!-- docs-check:docs-reference-cli-build-3 -->
```sh
rootform build --plan tfplan.json --output planned.json
```

See [plan inputs](../../inputs/plans.md) for producing the JSON with Terraform
or OpenTofu and handling its sensitive source data.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | The architecture was built. |
| `2` | The command was used incorrectly. |
| `3` | No complete architecture could be built. |

A built architecture can contain unclassified resource bases and interpretation
diagnostics. Read those diagnostics before making a coverage claim; their
presence alone is not a build failure. Status `3` means no complete
architecture could be built. `build` has no policy-violation exit: use
[`check`](check.md) for governance.
