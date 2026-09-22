---
title: "Choose an input"
description: "Choose configuration, a saved architecture, or a JSON plan according to the question you need to answer."
---

Choose the input that matches your task.

| Task | Input | Start with |
| --- | --- | --- |
| Explore existing configuration | Root module directory | `rootform run ./infra` |
| Reopen or use a previous result | Rootform architecture file | `rootform run architecture.json` |
| Examine planned instances or changes | Terraform/OpenTofu JSON plan | `rootform run --plan tfplan.json` |

## Explore a root module

Pass the Terraform or OpenTofu **root module directory**, not an isolated `.tf`
file:

```sh
rootform run ./infra
```

Rootform reads native and JSON configuration in `.tf`, `.tf.json`, `.tofu`,
and `.tofu.json` files. When matching OpenTofu and Terraform files have the
same base name and syntax form, the OpenTofu file takes precedence. For
example, `main.tofu` shadows `main.tf`, and `main.tofu.json` shadows
`main.tf.json`. Differently named files from both families can contribute to
the same analysis.

Each independent root module is its own analysis scope. In a repository with
several roots, run Rootform separately for each one. The selected directory is
also the project root for Rootform selection. Rootform reads `rootform.lock`
and optional vendored content from that project, without searching parent
directories. See [Project configuration](../cli.md) for selection, lock, and
vendoring details.

### Make modules available locally

Rootform follows local module calls only when their resolved paths remain
inside the selected root. A path that escapes that boundary, directly or
through a symlink, is refused.

Remote modules must already be materialized by Terraform or OpenTofu and
matched to their calls by `.terraform/modules/modules.json`. An arbitrary
directory under `.terraform/modules` is not enough. Missing, cyclic,
unresolved, or out-of-bound module paths remain explicit diagnostics.

Rootform does not run Terraform or OpenTofu, execute providers, contact a
backend, or evaluate the configuration as those tools would. Preparing modules
with your IaC tool is a separate operation with its own credentials and network
boundary.

### Distinguish declarations from instances

Configuration analysis describes declarations and the references Rootform can
establish from source. It does not load `.tfvars` or reproduce Terraform or
OpenTofu evaluation. A declaration using `count` or `for_each` therefore does
not promise one architecture object for every instance a planning operation
would create.

Use a JSON plan when your question depends on the instances and changes from a
specific planning operation.

## Reuse a saved architecture

A [Rootform architecture file](../concepts/architecture-ir.md) preserves the
compiled architecture, its semantic snapshot, diagnostics, and provenance.
You can open, inspect, explain, and compare a valid file without the original
Terraform or OpenTofu project:

```sh
rootform run architecture.json
rootform explain architecture aws_subnet.application --input architecture.json
rootform diff before.json after.json
```

Policy evaluation still needs an appropriate [Policy Pack](../concepts/policies.md)
selection. The saved document contains the architectural evidence used by
policies, but it does not implicitly contain every policy that should run.
`rootform check architecture.json` reads project Policy Pack selection from the
current working directory, or you can pass an explicit `--policy-pack` source.

Rootform validates saved documents before using them. An invalid document can
prevent comparison. Two valid documents with different semantic environments
are not rejected as a blanket rule. Source continuity can remain comparable,
while conclusions about interpretations or facts become undetermined when
compatibility and evidence closure cannot prove them. See
[Architecture Diff](../concepts/diff.md#semantic-changes-need-separate-review)
for that boundary.

To explore, export, compare, or check a planning result, follow the complete
[Terraform and OpenTofu plan procedure](plans.md).
