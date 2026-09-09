---
title: "CLI command reference"
description: "Understand Terraform and OpenTofu as architecture"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Understand Terraform and OpenTofu as architecture.

## Usage

```text
rootform [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform |
| ` -v, --version ` | ` bool ` | ` false ` | print the rootform version and exit |

## Behavior

Rootform turns Terraform and OpenTofu into a semantic, deterministic,
and explainable architecture.

Start with rootform run ./infra to explore a directory locally.

## Subcommands

| Command | Purpose |
| --- | --- |
| [` rootform build `](build.md) | Build an architecture |
| [` rootform check `](check.md) | Check architecture policies |
| [` rootform compile `](compile.md) | Compile a Policy Pack for offline checks |
| [` rootform completion `](completion.md) | Generate shell completion |
| [` rootform diff `](diff.md) | Compare two architectures |
| [` rootform explain `](explain.md) | Explain an architecture result |
| [` rootform fmt `](fmt.md) | Format Rootform files |
| [` rootform init `](init.md) | Initialize a Rootform project |
| [` rootform install `](install.md) | Install dialects |
| [` rootform list `](list.md) | List Rootform definitions |
| [` rootform lock `](lock.md) | Lock resolved dialects |
| [` rootform lsp `](lsp.md) | Serve Rootform language features over stdio |
| [` rootform package `](package.md) | Package Rootform content for distribution |
| [` rootform publish `](publish.md) | Publish packaged Rootform content |
| [` rootform remove `](remove.md) | Remove a dialect |
| [` rootform run `](run.md) | Explore an architecture locally |
| [` rootform show `](show.md) | Show a Rootform definition |
| [` rootform test `](test.md) | Test dialect fixtures |
| [` rootform validate `](validate.md) | Validate a Rootform object |
| [` rootform vendor `](vendor.md) | Vendor resolved Rootform packages |
| [` rootform verify `](verify.md) | Verify locked dialects |
| [` rootform version `](version.md) | Show the Rootform version |

## Examples

```sh
rootform run ./infra
rootform build ./infra -o architecture.json
rootform check ./infra
rootform diff ./before ./after
```
