---
title: "Locks and vendored content"
description: "Fix Dialect and Policy Pack selection, verify exact bytes, and execute without discovery."
---

Rootform separates supplied release set, explicit project selection, verified
bytes, and network acquisition.

## Release set and project lock

Rootform binary embeds RF Vocabulary and supplied Dialects as one immutable
release set. They need no install and never appear as ordinary project pins. A
project that uses only supplied content needs no lock, no init, and no network
access. See [Dialects and RF Vocabulary](concepts/dialects.md).

`rootform.lock` format 1 selects only explicit changes:

- additional third-party Dialects;
- whole-owner exclusions or replacements of supplied Dialects;
- Policy Pack sources.

Each selected entry records exact owner or pack name, version, content digest,
and local or OCI source. OCI source includes tagless repository, manifest
digest, layer digest, download size, and install size. No mutable tag or index
participates in execution.

Rootform commands never create or modify the lock.
[Add a third-party Dialect or Policy Pack](guides/external-content.md) defines
the entry shape. `rootform init` validates the existing lock; with
`--locked`, a missing lock fails. When an exact OCI pin is missing locally
and network is allowed, init may acquire only the recorded manifest digest.

## Controls

| Control | Scope |
| --- | --- |
| `init --locked` | Require valid existing lock; preserve bytes; acquire exact missing OCI pins if allowed |
| `init --offline` | Forbid registry access during preparation |
| `init --no-input` | Forbid prompts; no effect on selection |
| `vendor … --offline` | Materialize only verified local/cache bytes |
| `build/check/run --locked` | Require lock and execute without acquisition |

Build, check, run, diff, explain, list, show, validate, and test perform no
network acquisition and no prompt. Prepare first with `init` or vendor.

## Locations

Shared home:

```text title="Rootform home"
$ROOTFORM_HOME/dialects/<owner>/<version>/
$ROOTFORM_HOME/policy-packs/<name>/<version>/
```

Project vendor:

```text title="Project vendor"
.rootform/dialects/<owner>/<version>/
.rootform/policy-packs/<name>/<version>/
```

Third-party and replacement Dialects install under the shared home; Policy Pack
sources install under `$ROOTFORM_HOME/policy-packs`. When one project vendor
family exists it is exclusive for that family. Missing or modified content
never falls back to shared home or registry. RF Vocabulary and supplied
Dialects are embedded and never installed or vendored.

`$ROOTFORM_HOME/cache/linked-policy-packs` is derivable cache, not a source
or trust anchor. Corruption causes rebuild; it never changes selection.

## Offline transfer

On connected machine:

```sh
rootform init . --locked --no-input
rootform vendor dialects
rootform vendor policy-packs
```

On isolated execution machine, use committed lock and vendor directories.
Normal execution needs no `--offline` flag because it never contacts registry.
Use `vendor … --offline` to verify carried bytes without repair download. See
[Reproduce a build offline](guides/reproduce-build.md) for the full transfer
workflow.

Saved Architecture IR is self-contained for validation, Diff, and explanation.
Policy evaluation also needs selected source or linked Policy Pack artifact;
linked artifact binds exact saved semantic pins.

## OCI mirror

An OCI mirror copies the exact manifest, config, and layer descriptor graph
without repackaging. The only lock change is `source.oci.repository`; all
digests, sizes, versions, and content identities stay identical. Then validate
from an empty home:

```sh
ROOTFORM_HOME=/path/to/empty-rootform-home \
  rootform init . --locked --no-input
```

The client contacts only the rewritten repository at the locked manifest
digest. No fallback, enumeration, index, or original repository lookup occurs.
The mirror needs the same registry behavior as direct acquisition, described
in [registry compatibility](integrations/registry-compatibility.md).

Authentication follows Docker configuration (`DOCKER_CONFIG`, credential
helpers and store, then matching `auths`). Credentials are never written to
the lock, vendor tree, cache, or command output. `SSL_CERT_FILE` may add
bounded PEM roots for online registry access.

## Environment

| Variable | Meaning |
| --- | --- |
| `ROOTFORM_HOME` | Override Rootform home |
| `ROOTFORM_OFFLINE=1` | Request offline behavior for init and vendor |
| `ROOTFORM_INPUT=0` | Disable input for init |
| `CI=true` | Disable input; does not imply offline |
| `DOCKER_CONFIG` | Docker registry authentication directory |
| `SSL_CERT_FILE` | Additional bounded trust bundle for online acquisition |

See the [lock contract](../contracts/rootform-lock.md),
[Dialects and RF Vocabulary](concepts/dialects.md),
[Policies and Policy Packs](concepts/policies.md),
[reproduce a build](guides/reproduce-build.md), and
[registry compatibility](integrations/registry-compatibility.md).
