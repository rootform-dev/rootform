---
title: "rootform list"
description: "See Dialects, Policy Packs, and Policies accessible to a project."
---

`list` reports active Dialects, selected Policy Packs, or their declared
Policies. `list dialects <name>...` filters by positional owner names;
`--dialect` supplies a source directory for this run.
`list dialects --installed` and `list policy-packs --installed` inspect the
Rootform home without reading a project. It is not a remote catalog search. Use
[`show`](show.md) to inspect one definition and [`explain`](explain.md) to
trace a result.

<!-- BEGIN GENERATED CLI: rootform list -->

## Usage

```text
rootform list <command> [options]
```

## Options

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform list |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform list dialects `](list/dialects.md) | List the Dialect catalog |
| [` rootform list policies `](list/policies.md) | List Policies |
| [` rootform list policy-packs `](list/policy-packs.md) | List Policy Packs |

<!-- END GENERATED CLI -->

<!-- docs-check:cli-list-selection -->
```sh
rootform list dialects aws --format wide
rootform list policy-packs
rootform list policies
rootform list dialects --installed --format wide
rootform list policy-packs --installed --format wide
```

The first three commands inspect the project's active Dialect and Policy Pack
catalogs. The last two inspect installed OCI content in this machine's
Rootform home; a fresh home has no installed rows. Listing does not add a
selection or acquire content. Exit statuses vary by subcommand; see
[`list dialects`](list/dialects.md), [`list policies`](list/policies.md), and
[`list policy-packs`](list/policy-packs.md).

See [Install, add, and vendor](../../concepts/external-content.md) for
the difference between installed, selected, and active content.
