---
title: "rootform build"
description: "Compile Terraform or OpenTofu into a deterministic architecture file or self-contained HTML."
---

Build an architecture from a Terraform/OpenTofu directory or a JSON plan.
Write canonical JSON for another command, or self-contained HTML for a browser.

## Input and defaults

With no directory, `build` reads current directory. It uses supplied release
set plus explicit project selection. It performs no discovery, acquisition,
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
| ` --format ` | ` string ` | ` json ` | write `format` (json/html) |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform build |
| ` --locked ` | ` bool ` | ` false ` | require an existing valid rootform.lock |
| ` -o, --output ` | ` string ` | ` "" ` | write the architecture to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |

<!-- END GENERATED CLI -->

> [!NOTE]
> `--locked` requires an existing valid `rootform.lock`. Prepare missing exact
> OCI pins first with `rootform init --locked` or vendor them with `rootform vendor`.

## Save an architecture

From project using only supplied Dialects:

<!-- rootform:tabs Output format -->
<!-- rootform:tab JSON -->

```sh
rootform build . --output architecture.json
```

The output file contains architecture facts and their provenance, not the raw
Terraform configuration.

<!-- rootform:tab HTML -->

### Export HTML

```sh
rootform build . --format html --output architecture.html
```

Open file in browser. It contains its own renderer assets and needs no server
or sibling file.

<!-- rootform:endtabs -->

For the [VPC and subnet example](../../getting-started/first-architecture.md),
the declaration summary on standard error is:

```text title="Declaration summary"
Architecture built -> architecture.json

Resources     2 represented
Declarations  3 total, including 1 other declaration
Facts         1 resolved, 0 omitted
```

Terraform settings declaration has no representation. VPC and subnet retain
resource bases and applied Rules.

## Read a plan

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

A built architecture can contain unclassified resource bases and explicit
interpretation diagnostics. Read the summary before making a coverage claim.
`build` has no policy-violation exit: use `check` for governance.
