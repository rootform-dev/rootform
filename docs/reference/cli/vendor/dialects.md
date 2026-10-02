---
title: "rootform vendor dialects"
description: "Vendor the project's exact external Dialect selection."
---

From the project root, `vendor dialects` copies the external Dialects selected
by its `rootform.lock`, with licenses and notices. The lock must select at least
one external Dialect. Embedded Dialects, RF Vocabulary, Policy Packs, and
derived content are not copied. `vendor` can fetch missing selected OCI
content unless `--offline` is set.

<!-- BEGIN GENERATED CLI: rootform vendor dialects -->

## Usage

```text
rootform vendor dialects [options]
```

## Options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` --offline ` | ` bool ` | ` false ` | use no network; copy only local and installed Dialects |
| ` --project ` | ` string ` | ` "" ` | vendor what rootform.lock selects in project `dir`; paths stay relative to the working directory; default: the working directory |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; default: .rootform/dialects in the project |

### Global options

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor dialects |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |
| ` --no-pager ` | ` bool ` | ` false ` | print a long report in full instead of opening it in less |

<!-- END GENERATED CLI -->

`--to` changes the copy destination, not which project's lock is read. The
default destination is `./.rootform/dialects`; when present, commands run from
that project root use it exclusively for selected external Dialects. Use
`--offline` to restrict copies to exact local or installed content. Neither
vendoring nor `--to` changes the lock.

Start from a project whose lock selects an external Dialect, as in
[Add external content](../../../guides/external-content.md). The commands
below do not create that selection.

```sh
rootform init . --locked --no-input
rootform vendor dialects
rootform vendor dialects --offline --to ./offline/dialects
```

Copied names and versions go to standard output, diagnostics to standard
error. Status `0` means every selected unit was copied; `1` means selected
content is invalid, missing, or differs from `rootform.lock`; `2` means the
command was used incorrectly; `3` means no content was selected,
`rootform.lock` is invalid, or `--offline` needs content that is not
installed; and `4` means a file, the Rootform home, or the registry could not
be read or written. See
[Reproduce an analysis offline](../../../guides/reproduce-build.md).
