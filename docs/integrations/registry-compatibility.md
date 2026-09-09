---
title: Registry compatibility
description: Choose an OCI registry that supports Rootform artifacts, exact digests, and Docker authentication.
---

Rootform uses the
[`rootform-oci-core-v1`](../../contracts/rootform-oci-core-profile.md) profile
for Dialect and Policy Pack distribution. Registry-specific APIs are not part of
that contract.

## Supported registries

| Registry | Qualified behavior |
| --- | --- |
| GitHub Container Registry | Public artifact pull, tag and digest resolution, custom media types, and Bearer authentication. |
| CNCF Distribution 3.0 | Anonymous and private Basic-authenticated TLS repositories, publication, exact repull, and locked recovery. |

Compatibility with GitLab Container Registry, Azure Container Registry,
Harbor, Artifactory, Nexus, or another OCI registry is not implied by protocol
similarity. Use one only after its ordinary authentication and repository policy
have been verified against the Rootform profile.

## Required behavior

A registry must preserve custom OCI media types and support:

- manifest and blob reads by exact digest;
- manifest discovery by tag;
- blob upload and manifest publication for `rootform publish`;
- Docker-compatible anonymous, Basic, or Bearer authentication;
- immutable package-version handling expected by the publishing workflow.

Rootform resolves a tag during selection, then records the exact manifest and layer
digests in `rootform.lock`. Locked recovery reads those digests directly. A
registry that rewrites manifests or custom media types cannot preserve locked
identity.

## Credentials and private CAs

Rootform reads Docker `config.json` from `DOCKER_CONFIG`, or from the normal
Docker location when the variable is unset. Configured credential helpers must be
installed on `PATH`. A helper failure is terminal; Rootform does not silently
try another configured identity.

Set `SSL_CERT_FILE` to a bounded PEM bundle when the registry uses a private
certificate authority. Invalid trust data fails before Rootform uses an artifact.
Offline commands do not read registry credentials or the TLS bundle.

See [locks, sources, vendor, and offline operation](../offline-security.md) for
exact package identity and mirror routing.
