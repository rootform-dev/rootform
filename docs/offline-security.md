---
title: "Locks and vendored content"
description: "Understand the security boundary of exact project selection, offline preparation, and vendoring."
---

`rootform.lock` records exact project dependencies. `rootform add`, `remove`,
and `update` write it; `init` prepares what it already selects. A normal
`build`, `check`, `run`, `list`, or `show` never acquires content. See
[Install, add, and vendor](concepts/external-content.md) for the selection
model and [Where Rootform stores external content](reference/storage.md) for
paths, ownership, and command guarantees.

## What does the lock fix?

Format `1` records selected external Dialects and Policy Packs, embedded owner
exclusions, and explicit replacements. Each selected unit has an exact name,
version, compiled content digest, and either a project-relative local path or
complete OCI identity. An OCI tag is resolved by `add` or `update` and is never
recorded. Commit and review the lock with the source change it supports.

The lock does not record the Rootform binary, Terraform or OpenTofu providers,
modules, backend state, or credentials. Provider packages remain governed by
`.terraform.lock.hcl`. The [lock contract](../contracts/rootform-lock.md)
defines exact fields and validation.

## Preparation and offline controls

`rootform init --locked` requires an existing valid lock. Without a vendor
tree, it verifies local content at its recorded path without installing it.
It verifies installed OCI entries and may acquire a missing OCI unit only by
the recorded repository and manifest digest. It does not select a new version or
change the lock. When a vendor family exists, `init` verifies those exact
bytes, including the presence and absence of entries, because analysis reads
that family from `.rootform/`.

`--offline` and `ROOTFORM_OFFLINE=1` forbid acquisition by explicit commands
that could otherwise use the network. `init --locked --offline` proves that
every selected unit is available with its recorded content without network
access. `--no-input` disables prompts; it does not change acquisition policy.
`--locked` alone does not prevent `init` from acquiring exact missing pins.

## Why vendored content is exclusive

When `.rootform/dialects/` exists, selected Dialects are read only from that
tree. The same rule applies to `.rootform/policy-packs/`. Missing, extra, or
changed content fails closed. Rootform does not fall back to a local source,
installed copy, cache, or registry. Run `rootform vendor` to restore the tree
from the unchanged lock. A selection change through `add`, `remove`, or
`update` updates an existing vendor family together with the lock.

[Reproduce a build offline](guides/reproduce-build.md) walks through transfer
and independent replay. The [storage reference](reference/storage.md) lists
exact directories and recovery steps.

## Registry identity and credentials

An OCI mirror must preserve the exact manifest, config, and layer descriptor
graph. A manual change to `source.oci.repository` is valid only when the new
repository serves those same pins. Run `rootform init . --locked --no-input`
after editing to verify the result. Rootform never repairs an invalid lock.

`DOCKER_CONFIG` supplies registry credentials. `SSL_CERT_FILE` may supply
trusted PEM roots for online acquisition. Neither belongs in `rootform.lock`.
See [OCI registry compatibility](integrations/registry-compatibility.md) for
the acquisition contract.
