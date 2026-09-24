---
title: "Locks and vendored content"
description: "Understand the security boundary of exact project selection, offline preparation, and vendoring."
---

`rootform.lock` fixes a project's external content selection. `--offline`
controls acquisition when preparing it. Vendored content lets the project
carry its selection without relying on installed copies. For the state model,
see [Install, add, and vendor](concepts/external-content.md); for paths, see
[Where Rootform stores external content](reference/storage.md).

## What does the lock fix?

Format `1` records selected external Dialects and Policy Packs, embedded owner
exclusions, and replacements. Each selected unit has an exact name, version,
content identity, and local path or OCI source. An OCI tag is resolved when
selection changes and is never recorded. Commit and review the lock with the
source change it supports.

The lock does not record the Rootform binary, Terraform or OpenTofu providers,
modules, backend state, or credentials. Provider packages remain governed by
`.terraform.lock.hcl`. The [lock contract](../contracts/rootform-lock.md)
defines exact fields and validation.

## Preparation and offline controls

`rootform init --locked` requires an existing valid lock. It verifies the
selected local, installed, or vendored content. It may fetch missing OCI
content only by the exact identity in the lock. It never selects a new version
or changes the lock. Analysis commands do not acquire content.

`--offline` and `ROOTFORM_OFFLINE=1` forbid acquisition by `install`, `add`,
`update`, `init`, and `vendor`. A tag needs a registry lookup, so offline
selection requires a local source or an already installed digest reference.
`init --locked --offline` verifies that the selection is available locally
without acquiring anything. `--no-input` disables prompts, not network use.
`--locked` alone still permits `init` to fetch exact missing OCI content.

## Why vendored content is exclusive

When `.rootform/dialects/` exists, Rootform reads selected Dialects only from
that tree. The same rule applies to `.rootform/policy-packs/`. Missing, extra,
or changed content fails closed; Rootform does not substitute content from
another location. This prevents a damaged project copy from silently changing
the result on a machine with different installed content. Restore the family
with `rootform vendor` and verify it with `rootform init --locked --offline`.

[Reproduce a build offline](guides/reproduce-build.md) walks through transfer
and independent replay.

## OCI mirror

When moving an OCI selection to a mirror, copy the artifact without
repackaging it. The mirror must serve the same recorded identity. Change only
`source.oci.repository` in the lock, then run
`rootform init . --locked --no-input` to verify the new source. Rootform
does not repair an invalid lock.

`DOCKER_CONFIG` supplies registry credentials. `SSL_CERT_FILE` may supply
trusted PEM roots for online acquisition. Neither belongs in `rootform.lock`.
See [OCI registry compatibility](integrations/registry-compatibility.md) for
the exact registry contract.
