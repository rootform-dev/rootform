---
title: Registry compatibility
description: Check the qualified OCI registry paths and identities needed for Rootform packages.
---

An OCI registry is suitable for Rootform Dialect and Policy Pack artifacts only
when it preserves the [`rootform-oci-core-v1`](../../contracts/rootform-oci-core-profile.md)
profile. Generic OCI support is not a Rootform qualification. A qualification
applies to the tested registry and authentication path, not to every deployment
or feature of that product.

## Qualified registry paths

| Registry | Pull and authentication covered | Publication and identity covered | Boundary |
| --- | --- | --- | --- |
| GitHub Container Registry (GHCR) | Public package accessed with a Docker credential helper | Custom media types, publish, exact repull by digest, locked recovery, and vendor repair | The qualification does not separately assert the Bearer challenge exchange, anonymous pull, or private-package access. |
| CNCF Distribution 3.0 | Anonymous repository over TLS with a test CA | Custom media types, publish, exact repull by digest, locked recovery, and vendor repair | Private Basic authentication and other Distribution configurations are not covered by this qualification. |

Do not infer qualification for GitLab Container Registry, Azure Container
Registry, Harbor, Artifactory, Nexus, or another OCI product from protocol
similarity. A new path needs the same Rootform profile checks before it can
carry a locked selection.

## Required registry behavior

Rootform needs manifest resolution by version tag during publication and
review, manifest and blob reads by exact digest during locked acquisition,
and preservation of custom `artifactType`, config, and layer media types. When
publishing, the registry must accept blob uploads and manifest creation, then
return the exact manifest bytes for repull. Authentication must work through
Docker-compatible credentials when anonymous access is unavailable. Rootform
does not need registry catalog or tag listing.

| Identity | Role |
| --- | --- |
| Version tag | Human review and publication name, such as `dialect-<owner>-<version>` or `policy-pack-<name>-<version>`. A tag alone is not the lock identity. |
| Repository | Tagless OCI location recorded as `source.oci.repository` in `rootform.lock`. |
| `manifest_digest` | SHA-256 of the exact OCI manifest bytes selected by the lock. A registry that rewrites the manifest breaks this identity. |
| `layer_digest` | SHA-256 of the packaged layer bytes, checked separately from the manifest. |
| `content_digest` | Identity of the compiled Dialect or Policy Pack content, not a substitute for either OCI digest. |

`rootform publish` reports the repository, tag, digests, and sizes. Review that
identity before recording the complete pin in `rootform.lock`. `rootform init`
then requests the recorded repository and manifest digest directly. It does
not search tags or choose a newer version. See
[Locks and vendored content](../offline-security.md) for exact selection and
the [OCI mirror procedure](../offline-security.md#oci-mirror) for moving the
same descriptor graph without changing its digests.

## Private access and trust roots

Rootform reads Docker `config.json` from `DOCKER_CONFIG` or the standard Docker
location. Host-specific helpers, a global credential store, or matching
`auths` supply credentials according to the Docker configuration. A configured
helper must be installed on `PATH`; a helper failure does not silently fall
back to another identity. Set `SSL_CERT_FILE` to a bounded PEM bundle when a
private certificate authority is required. Invalid trust data fails before
Rootform uses an artifact.

Use [Container image](oci-image.md#use-private-registry-credentials) when
credentials must enter a container. `--offline` on `init` or `vendor` forbids
registry acquisition, regardless of credential availability.
