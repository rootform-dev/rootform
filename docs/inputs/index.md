---
title: "Terraform and OpenTofu inputs"
description: "Choose configuration, a saved architecture, or a JSON plan and understand what each input can establish."
---

Choose the input for the question you want to answer.

| Input | What it describes | Start with |
| --- | --- | --- |
| Configuration directory | Architecture established from source declarations and references. | `rootform run ./infra` |
| Rootform architecture JSON | Facts already compiled, including their provenance and diagnostics. | `rootform run architecture.json` |
| Terraform/OpenTofu JSON plan | Planned architecture, or the architectural difference stated by one plan. | `rootform build --plan tfplan.json` or `rootform diff --plan tfplan.json` |

## Analyze configuration

Pass the Terraform or OpenTofu **root module directory**, not a single `.tf`
file. Rootform reads native and JSON configuration (`.tf`, `.tf.json`, and
OpenTofu's `.tofu`/`.tofu.json` forms). OpenTofu files take precedence over
matching Terraform files under the OpenTofu profile.

The selected directory is also the project boundary. `rootform.lock` and
`.rootform/` belong directly there; Rootform does not search parent directories
for another project's selection. In a repository with several independent root
modules, analyze and prepare each root separately.

```sh
rootform run ./infra
```

Directory forms of `run`, `build`, and `check` prepare missing Dialects before
compiling. They use provider declarations and compatible
`.terraform.lock.hcl` evidence to choose semantics. Terraform and OpenTofu are
not invoked by these commands.

### Modules must be available locally

Rootform follows local module calls within the selected root. It can also read
remote modules already materialized by Terraform/OpenTofu and recorded in
`.terraform/modules/modules.json`. An arbitrary directory under `.terraform`
is not sufficient: the manifest entry must match the module call.

If a remote module is missing, initialize the project with your IaC tool, then
rerun Rootform. That initialization is a separate operation with its own provider,
backend, credential, and network requirements. Rootform never performs it for you.

A local module that escapes the selected root, including through a symlink, is
refused. Cycles and unresolved module sources remain diagnostics. Do not silence
those diagnostics by copying an incomplete architecture into a review.

### Declarations are not evaluated instances

Configuration analysis reads declared structure and reference evidence. It does
not execute Terraform expressions or providers, load live state, or use `.tfvars`
to reproduce Terraform evaluation. A `count` or `for_each` declaration is not a
promise that the diagram contains every deployed instance.

Use a [JSON plan](plans.md) when you need the resource instances stated by a
particular planning operation. A plan still does not make Rootform a live
infrastructure inventory.

## Reuse a saved architecture

```sh
rootform build . --output architecture.json
rootform run architecture.json
```

The file contains [Architecture IR](../concepts/architecture-ir.md). Serving it
uses the saved facts without re-reading Terraform or acquiring Dialects. A file
can also feed `check`, `diff`, or `explain architecture --input`.

`check` still needs selected Policy Packs available locally. Comparing two
files requires compatible Dialect identities. Rootform validates documents
before using them; malformed or incompatible input cannot support a successful
no-change or governance claim.

## Inputs Rootform does not accept as plans

A binary saved plan, a state document, and the event stream from
`terraform plan -json` are different formats. Export a saved plan with
`terraform show -json` or `tofu show -json` instead. The [plan guide](plans.md)
shows the complete procedure and its security boundary.
