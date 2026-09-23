---
title: "rootform explain architecture"
description: "Trace an architecture address to source and semantic evidence."
---

Pass a resource's source address, such as `google_compute_network.vpc`. By
default, Rootform builds from the current directory; `--input` accepts a
Terraform/OpenTofu directory, saved architecture JSON, or `-` for architecture
JSON on standard input. This command explains an element, not a Dialect Rule
definition.

<!-- BEGIN GENERATED CLI: rootform explain architecture -->

## Usage

```text
rootform explain architecture <address> [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain architecture |
| ` --input ` | ` string ` | ` "" ` | read architecture at `path`; use `-` for standard input |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

<!-- END GENERATED CLI -->

From the [first architecture](../../../getting-started/first-architecture.md)
project, after saving `architecture.json`:

<!-- docs-check:cli-explain-architecture -->
```sh
rootform explain architecture aws_subnet.application --input .
rootform explain architecture aws_subnet.application --input architecture.json --format json
```

Text is the default; JSON is also available. The explanation goes to standard
output and diagnostics to standard error. Status `0` means explained, `1`
means address not found, `2` means incorrect command use, and `3` means no
explanation could be decided. See [Explore an architecture](../../../guides/explore-architecture.md)
for source evidence in the interface.
