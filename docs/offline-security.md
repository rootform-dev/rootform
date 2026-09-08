---
title: "Locks, sources, vendor, and offline operation"
description: "Understand how Rootform fixes interpretation, verifies package identity, and runs without a registry."
---

An architecture depends on its source and the rules used to interpret it. Two
engineers using different Dialects can reach different architectural results
from the same Terraform. Rootform separates **selection**, **verified bytes**,
and **network access** so you can control each part.

## A source offers packages; a lock selects them

A package source is an OCI artifact or index reference used during preparation.
The official Dialect index supports discovery. You can add an explicit Dialect
artifact or index with `init --source`; Policy Packs require an explicit direct
artifact reference through `init --policy-pack`.

A tag is useful for finding a release, but it is not its final identity.
Initialization resolves the selection and records exact versions, content
identities, artifact repositories, manifest and layer digests, and sizes in
`rootform.lock`. These pins let another machine verify what it downloaded.

A **manifest digest** identifies an OCI manifest; a **layer digest** identifies
its payload bytes. Semantic and presentation digests identify different parts
of a Dialect. They are not interchangeable hashes. For example, changing OCI
provenance annotations can change a manifest digest without changing its layer.

Commit the reviewed project lock alongside your source. Do not copy one from an
unrelated project or hand-edit a version to request an upgrade. Rootform rejects
conflicting source identities instead of assigning implicit source priority.

## Choose what must stay fixed

| Control | What it fixes | What it still permits |
| --- | --- | --- |
| Existing `rootform.lock` | The project's recorded selection. | Explicit reviewed initialization can update it. |
| `--locked` | Requires the lock and preserves its bytes. | Downloading a missing artifact at its exact locked identity. |
| `--offline` | Prevents network access. | Reading verified local packages and cached discovery data. |
| `--no-input` | Prevents prompts and ambiguous choices. | A unique deterministic first selection; it does not imply offline. |

Combine `--locked --offline --no-input` when a run must preserve selection,
use only local material, and never prompt. Missing material is then a failure,
not permission to fetch a substitute.

A normal directory command can initialize a missing lock and resume its work.
With no input allowed, it never silently rewrites an existing lock. Use the
explicit initialization command reported in its diagnostic to review an update.

## Where verified packages live

The Rootform home normally lives at `~/.rootform/` (under the Windows user
profile on Windows). `ROOTFORM_HOME` replaces that directory. It contains
installed Dialects and Policy Packs, content-addressed download caches, cached
indexes, and temporary staging. Verified installed content is distinct from a
redownloadable cache.

Vendoring materializes exact locked packages under the project:

```text
.rootform/dialects/
.rootform/policy-packs/
```

Each directory is an **exclusive execution source when present**. A missing or
modified vendored file does not trigger a fallback to an installed store or a
registry. Dialects and Policy Packs have separate vendor directories; vendoring
one does not vendor the other.

Use `vendor dialects` or `vendor policy-packs` explicitly to populate or repair
those directories from the lock. These commands do not select newer versions
or rewrite the lock. They can recover exact artifacts from recorded repositories
unless `--offline` forbids it. Failed integrity or acquisition does not leave a
partly installed package as a successful result.

## When each mechanism helps

Use a lock when teammates or later builds must interpret source the same way.
Use a prepared home when several local projects can reuse verified packages.
Vendor when a project must carry its own exact semantic inputs, or when the
execution environment should work from an empty home without registry access.

A saved architecture is another useful boundary. Serving it, comparing saved
architectures, or explaining its saved facts does not acquire semantics.
Checking it still requires selected Policy Packs available locally. Self-contained
HTML already contains its renderer and needs no adjacent assets or CDN.

Follow [reproduce a build offline](guides/reproduce-build.md) for the procedure.
The [lock contract](../contracts/rootform-lock.md) defines exact fields.

## OCI mirrors for locked projects

Rootform supports a mirror through exact lock routing, not source priority.
First copy every artifact descriptor graph named by the lock to one
standards-compatible mirror repository without repackaging it. Verify that each
copied manifest retains its locked digest. Then change only
`entries[].artifact.repository` in `rootform.lock` to the tagless mirror
repository. Keep manifest and layer digests, sizes, semantic and presentation
digests, versions, `sources`, and `origins` unchanged. Review and commit that
lock change.

Validate the mirror from an empty store:

```sh
ROOTFORM_HOME=/path/to/empty-rootform-home \
  rootform init . --locked --no-input
```

Locked recovery contacts only each entry's rewritten repository at its exact
manifest digest. It does not read the recorded index, contact the original
artifact repository, or fall back there when the mirror is missing, unreachable,
or corrupt. After this acquisition, either retain the verified home or run
`rootform vendor dialects`; subsequent `--locked --offline` commands need no
registry or credentials.

Do not add a rewritten copy of the official index with `--source`. The official
index remains implicit, and same name/version entries from different artifact
repositories are an intentional source conflict even when their content
digests match. This strict rule prevents source priority from silently changing
artifact identity.

Online OCI authentication reads standard Docker configuration only. Non-empty
`DOCKER_CONFIG` takes precedence over current user's `~/.docker/config.json`;
host `credHelpers`, global `credsStore`, then matching `auths` determine
identity. Canonical `credentials not found` means no identity and permits
anonymous registry authentication; it never falls through to inline
credentials. Helper/store execution or decoding error never falls through to
another configured identity.
Rootform invokes helper `get` only, captures helper output, and keeps decoded
credentials and ORAS Basic/Bearer tokens in process memory. It emits and stores
no credential, Authorization header, Docker config content, or config path.
Policy-pack acquisition and publication use this same authentication path;
there is no pack-specific credential flag.
When `SSL_CERT_FILE` is set online, Rootform appends its bounded PEM bundle to
system roots; invalid content fails with a sanitized error. Offline mode creates
no registry client and reads neither credential source nor TLS bundle.

## Environment controls

| Variable | Meaning |
| --- | --- |
| `ROOTFORM_HOME` | Use this directory instead of the default Rootform home. |
| `ROOTFORM_OFFLINE=1` | Request offline operation. |
| `ROOTFORM_INPUT=0` | Disable interactive input. |
| `CI=true` | Disable interactive input; it does not imply offline. |
| `DOCKER_CONFIG` | Directory containing the Docker `config.json` used for registry authentication. |
| `SSL_CERT_FILE` | Additional bounded PEM trust bundle for online registry access. |

Project markers still belong to the selected root even when the home changes.
The [registry guide](integrations/registry-compatibility.md) covers registry
requirements; [troubleshooting](troubleshooting/index.md) covers missing pins,
credentials, conflicts, and damaged vendor content.
