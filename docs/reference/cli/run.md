---
title: "rootform run"
description: "Serve an architecture in a local explorer."
---

`run` builds from a Terraform/OpenTofu directory or loads a saved Rootform
architecture document. With no input it reads the current directory. Use
`--plan` for a JSON plan instead; `--plan -` reads that plan from standard
input. Directory input uses locally available content and does not acquire it.

<!-- BEGIN GENERATED CLI: rootform run -->

## Usage

```text
rootform run [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform run |
| ` --locked ` | ` bool ` | ` false ` | require an existing valid rootform.lock |
| ` --no-browser ` | ` bool ` | ` false ` | do not open the browser automatically |
| ` --no-watch ` | ` bool ` | ` false ` | build once instead of rebuilding when a file changes |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` --port ` | ` int ` | ` 21717 ` | serve on local `port`; 0 picks a free one |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

## Local server

`run` serves the explorer in the foreground and opens a browser by default.
It prints the local address to standard output and diagnostics to standard
error. Stop it with `Ctrl+C`. For directory input, source changes trigger
rebuilds unless `--no-watch` is set; a saved document or plan is not watched
as Terraform source. `--no-browser` leaves the browser closed. The default
port is `21717`; `--port 0` asks the operating system for a free port. Use
`--locked` when directory input must have a valid existing lock.

Use a prepared project for `./infra`, an architecture saved by `build` for
`architecture.json`, or a completed JSON plan from [Plan inputs](../../inputs/plans.md).

```sh
rootform run ./infra
rootform run architecture.json --no-browser --port 0
rootform run --plan tfplan.json --no-watch
```

Status `0` means the local interface stopped cleanly, `1` means it could not
start, and `2` means incorrect command use. For navigation and evidence in the
explorer, see [Explore an architecture](../../guides/explore-architecture.md).
