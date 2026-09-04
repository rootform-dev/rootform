# Policy pack distribution contract

Current distribution format version: `1`.

Rootform separates architecture semantics from architecture governance.
Dialects define what a declaration means; policy packs define which meanings
are acceptable. A policy always belongs to exactly one policy pack and never to
a dialect.

Rootform policy packs are distributed as OCI image manifests with
content-addressed blobs, following the same lifecycle as dialects:

```text
VCS                -> authoring
OCI                -> distribution
direct references  -> explicit selection
rootform.lock      -> exact selection
.rootform/policy-packs -> project-local execution
store/cache        -> materialization and offline reuse
Docker credentials -> private registry authentication
```

This document defines wire compatibility; it does not claim that any registry
artifact has been published. Required registry behavior is the forge-neutral
[`rootform-oci-core-v1`](rootform-oci-core-profile.md) profile.

## Policy pack artifact

One policy pack version is an OCI 1.1 artifact with:

- artifact type `application/vnd.rootform.policy-pack.v1`;
- config media type
  `application/vnd.rootform.policy-pack.manifest.v1+json`;
- exactly one layer with media type
  `application/vnd.rootform.policy-pack.layer.v1.tar+gzip`.

Config JSON is strict and canonical. It contains format version, pack name and
version, exact dialect requirements, pack content digest, layer digest,
download size, install size, and file count. Requirement arrays use canonical
lexical order.

Layer is deterministic gzip over deterministic tar. Entries are regular files
with normalized mode, ownership, and timestamps. Allowed content is limited to:

- Rootform policy sources: `*.rf` and `*.rf.json`;
- license and notice text named `LICENSE*`, `NOTICE*`, or
  `THIRD_PARTY_NOTICES*`.

Paths must be clean relative slash-separated paths. Absolute paths, traversal,
backslashes, duplicates, symlinks, hard links, devices, sockets, and other
irregular entries are invalid. SVG, HTML, CSS, URLs, presentation assets, and
arbitrary executable content are outside this boundary. A policy pack carries
no presentation manifest; policy meaning is the content itself.

Limits are 16 MiB compressed, 64 MiB installed, 4 MiB per file, and 512 files
per policy pack artifact. Declared digest, byte size, installed size, file
count, name, version, policy, and content identities must all match fetched and
compiled content.

## Provenance annotations

Package author may supply standard OCI manifest annotations:

- `org.opencontainers.image.source`;
- `org.opencontainers.image.revision`;
- `org.opencontainers.image.documentation`;
- `org.opencontainers.image.licenses`.

Rootform applies same explicit values to every policy pack manifest in one
layout. URLs are canonical HTTPS without credentials, query, or fragment;
revision and license text are bounded. Values are informational and participate
in manifest digest because annotations are manifest bytes. Rootform does not
discover Git state, invoke VCS, add machine paths, or invent current
timestamps. Manifest digest remains technical identity.

`rootform show policy-pack` and `rootform list policy-packs` expose available
provenance with version, execution source, artifact repository, manifest and
layer digests, and content digest. Missing optional provenance remains absent
rather than inferred.

## Generic publication

Packaging and publication are separate:

```text
rootform package policy-packs SOURCE --to LAYOUT
rootform publish policy-packs LAYOUT --to REPOSITORY
```

Package command is local and offline and accepts the same explicit
`--source-url`, `--revision`, `--documentation-url`, and `--licenses`
provenance values as dialect packaging. Publish command accepts one existing
validated Rootform OCI layout and one canonical tagless repository. Pack
identity and version come only from compiled package content. Destination tags
are `policy-pack-<name>-<version>`; no identity, version, or tag override
exists.

Publisher validates complete local layout before creating registry client,
preflights every requested immutable tag, repulls by manifest digest, and
passes complete manifest, config, layer, archive, policy, and content
verification before success. Existing exact digest is idempotent; differing
digest fails. V0 has no Policy Pack index and never moves a mutable discovery
tag. `--dry-run` performs complete local validation and reports exact tags,
digests, sizes, and provenance without reading credentials or contacting
registry.

Publication reuses the same Docker configuration, credential-helper, Basic,
and Bearer path as acquisition. Rootform exposes no pack-specific credential
flag and persists no credential.

## Explicit source resolution

Repeatable `rootform init --policy-pack` accepts canonical
registry/repository references by tag or SHA-256 digest. Validated artifact
type must identify one direct Policy Pack. URLs, embedded credentials,
repository-only values, other Rootform artifact types, registry enumeration,
and VCS resolution are rejected.

Repeated identical references deduplicate. References resolving more than once
to same pack name conflict rather than choosing by order. Missing exact packs
never trigger arbitrary registry search. `--policy-pack` is incompatible with
`--locked`.

## Integrity and installation

Every OCI descriptor uses SHA-256 and declared size. Client verifies
descriptor, OCI shape, strict manifest, archive bounds, extracted content, then
recompiles content identity before installation becomes visible. Installation
stages beneath Rootform temporary home and atomically renames to immutable
`policy-packs/<name>/<version>`. Existing same-version content must match exact
acquisition identity; it is never silently replaced.

Cached content is a reproducible acquisition input, not a trust anchor. Corrupt,
incomplete, unexpected, or same-version changed content fails closed.

When project `.rootform/policy-packs/` exists, it is exclusive execution source
for project `check` and policy listing; those commands never fall back to
store, cache, or registry. `rootform vendor policy-packs` is explicit
materialization and repair boundary. It copies exact lock pins from verified
store or cache and may download exact manifest digest from recorded artifact
repository. It performs no discovery, new selection, upgrade, or lock
modification. Legal and notice files inside artifact remain vendored.

## Honest limits

- Policy packs never change or append dialect semantics, and dialects never
  carry, override, or append policy.
- Pack selection is never automatic: a project evaluates only packs recorded in
  its lock or named explicitly.
- The language server is pack-less: it does not load, evaluate, or require
  policy packs.
- `validate policy` and `explain policy` can inspect packs already selected by
  the project, but do not accept a local `--policy-pack` authoring directory.
- V0 provides no Policy Pack index and no mutable pack discovery tag.
- Execution never depends on VCS.

Related contracts:

- [`policy-result.md`](policy-result.md);
- [`rootform-lock.md`](rootform-lock.md);
- [`../docs/offline-security.md`](../docs/offline-security.md).
