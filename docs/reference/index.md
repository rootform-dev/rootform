---
title: "Reference"
description: "Find exact commands, output contracts, and the right procedure for a Rootform task."
---

The [CLI command reference](cli/index.md) follows the actual command tree.
Each command records usage, public flags, declared defaults, aliases and examples
when present. Inherited flags appear separately when a command has them.

For a guided task, start with:

| Task | Guide | Command |
| --- | --- | --- |
| Get a first architecture | [First architecture](../getting-started/first-architecture.md) | [run](cli/run.md), [build](cli/build.md) |
| Prepare or update a project | [Project preparation](../cli.md) | [init](cli/init.md) |
| Inspect the meaning of a result | [Architecture IR](../concepts/architecture-ir.md) | [explain architecture](cli/explain/architecture.md) |
| Evaluate a rule | [Check an architecture](../guides/check-architecture.md) | [check](cli/check.md) |
| Compare two versions | [Compare architectures](../guides/compare-architectures.md) | [diff](cli/diff.md) |
| Use planning evidence | [Terraform/OpenTofu plans](../inputs/plans.md) | [build](cli/build.md), [diff](cli/diff.md) |
| Work without a registry | [Reproduce a build offline](../guides/reproduce-build.md) | [vendor dialects](cli/vendor/dialects.md) |

## Read command notation

Square brackets mark optional input. Angle brackets mark a value you supply.
Do not type the brackets themselves. Examples in generated help use project
paths and identifiers that you replace with those from your own project.

An empty string default is shown as `""`. A boolean flag such as `--offline`
sets `true` when passed without a value; use `--offline=false` for an explicit
false value. Repeated string-array flags collect values rather than replacing
the previous occurrence.

Flags belong to their documented command. In particular, root-level `-v` means
`--version`; commands that expose `-v, --verbose` use it for detail. It is not a
global verbosity flag inherited by the tree.

```sh
rootform --help
rootform build --help
rootform help build
```

Installed help describes your executable. These docs are verified against the
current local implementation; the [installation page](../installation.md#available-release)
identifies the published archive and its renderer availability.

## Machine contracts

[Outputs and exit status](outputs.md) explains how to choose a format and keep
standard output separate from diagnostics. The public
[contracts](../../contracts/README.md) and
[Architecture IR schema](../../schemas/architecture-ir.schema.json) define data
consumed by integrations. Product version and document format version are
separate identities.
