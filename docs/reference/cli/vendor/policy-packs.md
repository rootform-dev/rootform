---
title: "rootform vendor policy-packs"
description: "Vendor the project's exact Policy Pack source selection."
---

From the project root, `vendor policy-packs` copies Policy Pack sources selected
by its `rootform.lock`, with licenses and notices. The lock must select at
least one Policy Pack. It does not copy Dialects,
resolve versions, or change the lock. It can fetch missing selected OCI
content unless `--offline` is set.

<!-- BEGIN GENERATED CLI: rootform vendor policy-packs -->

## Usage

```text
rootform vendor policy-packs [options]
```

## Options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --offline ` | ` bool ` | ` false ` | use no network; copy only local and installed Policy Packs |
| ` --to ` | ` string ` | ` "" ` | copy into `directory`; ./.rootform/policy-packs by default |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform vendor policy-packs |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

<!-- END GENERATED CLI -->

`--to` changes the destination, not the project selection. The default is
`./.rootform/policy-packs`; when present, project-selected Policy Packs are
read exclusively there. An explicit local `--policy-pack` on a consuming
command overlays a Policy Pack of the same name for that invocation; other
selected Policy Packs remain active. `--offline` limits vendoring to verified
local or installed content.

Start from a project whose lock selects a Policy Pack, as in
[Use external content](../../../guides/external-content.md). The commands
below do not create that selection.

<!-- docs-check:docs-reference-cli-vendor-policy-packs-1 -->
```sh
rootform init . --locked --no-input
rootform vendor policy-packs
rootform vendor policy-packs --offline --to ./offline/policy-packs
```

The first vendor command prints the default `.rootform/policy-packs`
destination; the second prints `./offline/policy-packs`. Both name every
copied Policy Pack and version. Copied names and versions go to standard
output, diagnostics to standard error. Status `0` means every selected unit
was copied; `1` means selected content is invalid, missing, or differs from
`rootform.lock`; `2` means the command was used incorrectly; `3` means no
content was selected, `rootform.lock` is invalid, or `--offline` needs content
that is not installed; and `4` means a file, the Rootform home, or the registry
could not be read or written. See
[Reproduce an analysis offline](../../../guides/reproduce-build.md).
