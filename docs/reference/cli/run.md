---
title: "rootform run"
description: "Explore an architecture locally"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Explore an architecture locally.

## Usage

```text
rootform run [input] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform run |
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-browser ` | ` bool ` | ` false ` | do not open the browser automatically |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --no-watch ` | ` bool ` | ` false ` | build once instead of rebuilding when a file changes |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` --plan ` | ` file ` | ` "" ` | read JSON plan; - reads standard input |
| ` --port ` | ` int ` | ` 21717 ` | serve on local `port`; 0 picks a free one |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Build or load an architecture and serve its interactive interface
locally.

The input can be an infrastructure directory or a Rootform architecture
file. With no input, run reads the current directory. --plan reads a plan
in JSON format instead; use - to read it from standard input. Directory
input prepares missing project dialects before starting the server.

The local address goes to standard output. Diagnostics go to standard
error.

## Exit status

```text
0  the local interface stopped cleanly
1  the local interface could not start
2  the command was used incorrectly
```

## Examples

```sh
rootform run
rootform run ./infra
rootform run architecture.json --no-browser
rootform run --plan tfplan.json
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../index.md).
