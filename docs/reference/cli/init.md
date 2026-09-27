---
title: "rootform init"
description: "Prepare an existing project selection locally."
---

`init` prepares the exact external Dialects and Policy Pack sources already
selected by `rootform.lock`. The optional path defaults to `.` and identifies
both project and Terraform/OpenTofu root. It does not detect providers, pick
versions, modify the lock, or run `terraform init`.

<!-- BEGIN GENERATED CLI: rootform init -->

## Usage

```text
rootform init [path] [options]
```

## Options

### Preparation

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --offline ` | ` bool ` | ` false ` | use no network; accept local and installed sources |

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --details ` | ` bool ` | ` false ` | list every prepared unit's status and source on standard error |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform init |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

<!-- END GENERATED CLI -->

## Lock and acquisition

An existing lock is preserved. Without a lock, ordinary `init` has an empty
selection; `--locked` instead requires an existing valid lock. Embedded
Dialects need no acquisition. For selected OCI content, `init` may fetch
only exact selected digests when network use is allowed. If a vendor family
exists, `init` verifies its exact tree, including missing, extra, or changed
content; a valid tree needs no installed copy or registry access. `--offline`
restricts preparation to verified local content. `--no-input` disallows
prompts and requires deterministic action.

Replace `./infra` with an existing project directory. The `--locked` example
requires that project to contain a valid `rootform.lock` beforehand.
Run the first command to prepare its selection, the second to prove it can be
prepared from local bytes alone, and the third when a machine-readable result
is needed.

<!-- docs-check:cli-init -->
```sh
rootform init ./infra --no-input
rootform init ./infra --locked --offline --no-input
rootform init ./infra --format json
```

With external content selected, text output starts with `Project prepared`,
then reports `External Dialects` and `External Policy Packs` counts. With no
external content selected, it starts with `Project ready`, then reports
`External content  none`. Machine JSON goes to standard output; diagnostics and
`--details` output go to standard error. Neither text nor JSON writes
`rootform.lock`. Status `0` means preparation completed; `1` means selected
content is invalid, missing, or differs from `rootform.lock`; `2` means the
command was used incorrectly; `3` means `rootform.lock` is required or invalid,
or `--offline` needs content that is not installed; and `4` means a file, the
Rootform home, or the registry could not be read or written. See
[Select Dialects and Policy Packs](../../cli.md) and
[External content storage](../storage.md).
