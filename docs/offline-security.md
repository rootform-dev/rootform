---
title: "Locks, offline preparation, and vendored content"
description: "Understand exact project selection, offline preparation, storage, and fail-closed vendoring."
---

`rootform.lock` records a project's explicit Rootform content selection.
Preparation verifies that selection. Vendoring carries selected content inside
the project and becomes an exclusive execution source.

## What does rootform.lock fix?

Format `1` records external Dialects, Policy Pack sources, embedded-owner
exclusions, and explicit replacements. Each selected unit has an exact name,
version, compiled `content_digest`, and either a local path or complete OCI
identity.

The lock does not record Rootform binary version, embedded release-set pins,
Terraform or OpenTofu provider versions, provider installation, modules,
backend state, or credentials. It is also not proof that a Policy Pack was
selected. The required `policy_packs` array can be empty.

Rootform commands never create, normalize, or update the lock. Use
[external content](guides/external-content.md) to write one from reviewed
identities. The exact fields are defined by the
[`rootform.lock` contract](../contracts/rootform-lock.md).

## How is this different from .terraform.lock.hcl?

`.terraform.lock.hcl` belongs to Terraform or OpenTofu and pins provider
packages. `rootform.lock` belongs to Rootform and selects architecture Dialects
and governance Policy Packs. Neither file replaces the other.

## What does init do?

`rootform init [path]` prepares selections that already exist:

- local entries are compiled and compared with locked identity
- installed content is verified before reuse
- missing OCI entries may be acquired only by locked repository and manifest
  digest when network access is allowed
- lock bytes remain unchanged

With no lock, ordinary `init` prepares an empty external selection. With
`--locked`, a missing or invalid lock fails. `init` never detects providers,
chooses a version, or adds a Policy Pack.

## How do --locked and --offline differ?

| Control | Guarantee |
| --- | --- |
| `--locked` | Require a valid existing lock and preserve it. `init --locked` may still acquire an exact missing OCI pin. |
| `--offline` | Forbid acquisition for commands that can prepare or vendor content. Required bytes must already be local. |
| `--no-input` | Disable prompts. It does not change selection or network policy. |

`build`, `check`, and `run` never acquire content implicitly. Their `--locked`
flag requires the lock and keeps execution read-only with respect to selection.
Prepare missing content explicitly with `init` or `vendor`.

## Where does Rootform read selected content?

Embedded RF Vocabulary and supplied Dialects stay inside the exact Rootform
binary. They are never installed or vendored separately.

External content can come from these locations:

```text title="Shared Rootform home"
$ROOTFORM_HOME/dialects/<owner>/<version>/
$ROOTFORM_HOME/policy-packs/<name>/<version>/
```

```text title="Project vendor"
.rootform/dialects/<owner>/
.rootform/policy-packs/<name>/
```

Local lock entries read their project-relative source paths when no vendor tree
for that family exists. OCI entries read verified installed content from
`ROOTFORM_HOME` after explicit preparation.

Policy Pack source directories contain the authored manifest and policies. A
compiled Policy Pack is a strict replay artifact linked to one semantic
snapshot. `$ROOTFORM_HOME/cache/linked-policy-packs` is a derived cache that
Rootform can rebuild. It is neither selection authority nor content to vendor.

## What changes when vendor exists?

`rootform vendor dialects` writes `.rootform/dialects`.
`rootform vendor policy-packs` writes `.rootform/policy-packs`. Each command
must run from the project root whose `rootform.lock` it materializes, unless an
explicit `--to` destination is used for another purpose.

Presence of one vendor family makes that directory exclusive for its selected
kind. Every locked entry must be present and exact. Missing, extra, or altered
content fails before Rootform consults local source, shared home, cache, or a
registry. Normal execution never repairs vendor state silently.

Vendoring is explicit and atomic. It stages and verifies the complete selected
family before replacing the destination. `vendor … --offline` permits only
verified local, installed, or cached bytes and never changes the lock.

## OCI mirror

An OCI mirror copies the exact manifest, config, and layer descriptor graph
without repackaging. Change only `source.oci.repository` in the lock. Manifest,
layer, content digests, sizes, names, and versions remain identical.

`rootform init . --locked --no-input` then contacts only the rewritten
repository at the recorded manifest digest. Registry compatibility and private
authentication follow the [OCI registry compatibility](integrations/registry-compatibility.md)
contract.

Docker configuration supplies registry credentials through `DOCKER_CONFIG`.
`SSL_CERT_FILE` can add bounded PEM roots for online acquisition.
`ROOTFORM_HOME` changes the shared Rootform home. `ROOTFORM_OFFLINE=1` requests
offline behavior for `init` and `vendor`, while `ROOTFORM_INPUT=0` disables
input. These settings do not change project selection.

For an end-to-end transfer, continue with
[Reproduce a build offline](guides/reproduce-build.md).
