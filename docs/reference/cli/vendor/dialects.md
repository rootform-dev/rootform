---
title: "rootform vendor dialects"
description: "Vendor resolved dialects"
---

<!-- Generated from reference/cli.json. Run bun run generate:cli; do not edit this page. -->

Vendor resolved dialects.

## Usage

```text
rootform vendor dialects [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor dialects |
| ` --offline ` | ` bool ` | ` false ` | use only exact installed or cached dialects |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; ./.rootform/dialects by default |

Boolean flags set `true` when supplied without a value. Set the flag value to `false` to disable one. `""` means an empty string.

## Behavior

Materialize the exact rootform.lock dialect set from the installed
store, content cache, or pinned registry repositories. No version is resolved
and rootform.lock is never changed.

With no --to flag, vendor writes ./.rootform/dialects. Consuming
commands launched from that project root use that directory automatically.
Copied names and versions go to standard output. Diagnostics go to
standard error.

## Exit status

```text
0  every resolved dialect was copied
2  the command was used incorrectly
3  no complete vendored set was written
```

## Examples

```sh
rootform init . --no-input
rootform vendor dialects
rootform vendor dialects --to ./offline/dialects
```

Command syntax and help are generated from the executable's command definitions. For guided tasks, start with the [reference overview](../../index.md).
