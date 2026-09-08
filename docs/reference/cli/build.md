---
title: "rootform build"
description: "Compile Terraform or OpenTofu into a deterministic architecture file or self-contained HTML."
---

Build an architecture from a Terraform/OpenTofu directory or a JSON plan.
Write canonical JSON for another command, or self-contained HTML for a browser.

## Input and defaults

With no directory, `build` reads the current directory. Directory input prepares
missing project Dialects before compilation. A coherent local lock is silent.
Use `--plan` instead of a directory to read a JSON plan; `-` reads that plan
from standard input. Plan input requires prepared semantics.

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
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` -o, --output ` | ` string ` | ` "" ` | write the architecture to this `file` |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

<!-- END GENERATED CLI -->

`--locked` can download a missing artifact at its exact locked identity.
Combine it with `--offline` when selection and network access must both be fixed.
In a non-interactive normal command, an existing lock is never silently updated;
run the explicit initialization command reported by the diagnostic.

## Save an architecture

From a prepared project:

```sh
rootform build . --locked --output architecture.json
```

For the [VPC and subnet example](../../getting-started/first-architecture.md),
the declaration summary on standard error is:

```text
Declarations detected           3
Represented                     2
Supporting a composition        0
Filtered by rule                1
Unsupported                     0
Failed                          0
```

The Terraform settings declaration is filtered as language settings. The VPC
and subnet are represented. The output file contains those facts and their
provenance, not the raw Terraform configuration.

## Export HTML offline

After the required Dialects are available locally:

```sh
rootform build . --locked --offline --format html --output architecture.html
```

Open the file in a browser. It contains its own renderer assets and needs no
server or sibling file.

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

A built architecture can still contain explicitly unsupported declarations.
Read its accounting and diagnostics before making a coverage claim.
`build` has no policy-violation exit: use `check` for governance.

## Verify your installed command

Usage and flag tables are generated from the actual command definitions. The
worked example is exercised with the identified documentation verification build.
To inspect your installed executable:

```sh
rootform build --help
```
