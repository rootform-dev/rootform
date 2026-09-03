# OCI registry compatibility

Rootform claims registry compatibility only against
[`rootform-oci-core-v1`](../../contracts/rootform-oci-core-profile.md).
Brand-specific APIs are outside profile.

Reusable qualification performs:

```text
offline package and publication dry-run
-> publish custom media types
-> repeat publication idempotently
-> pull direct dialect by tag and digest
-> resolve additional index
-> recover exact lock into empty store
-> vendor exact lock from empty store
-> build/check from vendor with network disabled
-> reject partial vendor without credential access
-> verify Docker credential helper and sanitized evidence
```

Candidate gate runs full matrix against ephemeral CNCF Distribution instances,
including anonymous, Basic, TLS, and credential-helper paths. It also runs
reusable profile qualification against private GHCR, where package visibility
plus same additional-index proof cover a private index and Bearer challenge
exchange. It deletes transient test package after evidence upload.

GitLab Container Registry, Azure Container Registry, Harbor, Artifactory, and
Nexus are likely candidates because Rootform uses standard OCI Distribution
operations only. They are not claimed compatible until same suite passes real
endpoint with product's ordinary authentication and policy configuration.

Qualification evidence records profile identifier, repository, exact dialect
and index manifest digests, semantic and presentation digests, standard
provenance, and passed capabilities. It records no credential or local path.
