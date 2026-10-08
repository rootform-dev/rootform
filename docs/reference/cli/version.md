---
title: "rootform version"
description: "Identify the Rootform executable."
---

`version` prints the running Rootform executable's version to standard output.
Diagnostics go to standard error. `rootform --version` is the root flag form.

<!-- BEGIN GENERATED CLI: rootform version -->

## Usage

```text
rootform version [options]
```

## Options

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform version |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

```sh
rootform version
rootform --version
```

Status `0` means the version was printed, `2` means the command was used
incorrectly, and `4` means the version could not be written.
