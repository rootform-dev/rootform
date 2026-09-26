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
rootform init [path] [flags]
```

## Flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --format ` | ` string ` | ` text ` | output `format`: text or json |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform init |
| ` --locked ` | ` bool ` | ` false ` | require and preserve the existing rootform.lock |
| ` --no-input ` | ` bool ` | ` false ` | never prompt; require deterministic action |
| ` --offline ` | ` bool ` | ` false ` | disable network; use only local data |
| ` -v, --verbose ` | ` bool ` | ` false ` | show provider evidence and origin |

## Inherited flags

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --color ` | ` mode ` | ` auto ` | color human output: auto, always, never |

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

Machine JSON goes to standard output when selected; diagnostics and `--verbose`
detail go to standard error. Text prints `Project prepared` and the counts of
external Dialects and Policy Packs. JSON reports the same preparation result;
neither form changes the lock. Status `0` means preparation completed, `1` means
it failed, `2` means incorrect command use, and `3` means deterministic
preparation was unavailable. See [Select Dialects and Policy Packs](../../cli.md)
and [External content storage](../storage.md).
