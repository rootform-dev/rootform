# Dialect distribution contract

Current distribution format version: `1`.

This contract governs third-party and replacement Dialects only. The RF
Vocabulary and the supplied Dialects of the Rootform release set are embedded
in the Rootform binary and delivered by release-set upgrade; they are never
packaged, published, installed, vendored, indexed, or selected independently.
OCI dialect packaging remains the format for explicit third-party Dialects
and explicit replacements.

Rootform Dialects use OCI image manifests and content-addressed
blobs. This document defines wire compatibility; it does not claim that any
registry artifact has been published. There is no Dialect index artifact and
no implicit discovery default. Required registry
behavior is the forge-neutral
[`rootform-oci-core-v1`](rootform-oci-core-profile.md) profile.

## Dialect artifact

One dialect version is an OCI 1.1 artifact with:

- artifact type `application/vnd.rootform.dialect.v1`;
- config media type
  `application/vnd.rootform.dialect.manifest.v1+json`;
- exactly one layer with media type
  `application/vnd.rootform.dialect.layer.v1.tar+gzip`.

Config JSON is strict and canonical. It contains format version, Dialect owner
and version, RF Language version, exact RF Vocabulary version and semantic
digest, covered provider sources and compatibility constraints, layer digest,
content digest, executable semantic digest, presentation digest, download size,
install size, and file count. Provider entries use canonical lexical order.
RF Vocabulary identity is derived from actual references, never a hand-written
dependency list.

Layer is deterministic gzip over deterministic tar. Entries are regular files
with normalized mode, ownership, and timestamps. Allowed content is limited to:

- Rootform dialect sources: `*.rf.hcl` and `*.rf.json`;
- one `presentation.json`;
- license and notice text named `LICENSE*`, `NOTICE*`, or
  `THIRD_PARTY_NOTICES*`.

Paths must be clean relative slash-separated paths. Absolute paths, traversal,
backslashes, duplicates, symlinks, hard links, devices, sockets, and other
irregular entries are invalid. SVG, HTML, CSS, URLs, and arbitrary executable
content are outside this boundary.

Limits are 16 MiB compressed, 64 MiB installed, 4 MiB per file, and 512 files
per dialect artifact. Declared digest, byte size, installed size, file count,
owner, version, dependency, provider, semantic, and presentation identities
must all match fetched and compiled content.

## Provenance annotations

Package author may supply standard OCI manifest annotations:

- `org.opencontainers.image.source`;
- `org.opencontainers.image.revision`;
- `org.opencontainers.image.documentation`;
- `org.opencontainers.image.licenses`.

Rootform applies the same explicit values to every dialect manifest in one
layout. URLs are canonical HTTPS without credentials, query, or fragment;
revision and license text are bounded. Values are informational and participate
in manifest digest because annotations are manifest bytes. Rootform does not
discover Git state, invoke VCS, add machine paths, or invent current timestamps.
Manifest digest remains technical identity.

`rootform show dialect` and `rootform list dialects` expose effective owner,
version, origin, and content digest. Package and publication results expose OCI
repository, tag, manifest digest, size, and explicit provenance. Missing
optional provenance remains absent rather than inferred.

## Generic publication

Packaging and publication are separate:

```text
rootform package dialects SOURCE --to LAYOUT
rootform publish dialects LAYOUT --to REPOSITORY
```

Package command is local and offline and accepts explicit
`--source-url`, `--revision`, `--documentation-url`, and `--licenses`
provenance values. The package command takes no repository argument: the
repository belongs to the publish destination. Publish command accepts one
existing validated Rootform OCI layout and one canonical tagless repository.
Dialect identity and version come only from compiled package content.
Destination tags are `dialect-<owner>-<version>`; no identity, version, or tag
override exists.

Publisher validates the complete local layout and compiled dependency closure
before creating a registry client. It preflights every requested immutable tag
before first write. Existing exact digest is idempotent; differing digest
fails. Missing dialect graphs publish in canonical order, resolve by expected
digest, repull by manifest digest, and pass complete manifest, config, layer,
archive, dependency, semantic, and presentation verification before success.

V0 defines no Dialect index artifact and never moves a mutable discovery tag.
`--dry-run` performs complete local validation and reports exact tags,
digests, sizes, and provenance without reading credentials or contacting
registry.

Publication reuses the same Docker configuration, credential-helper, Basic, and
Bearer path as Dialect acquisition. Rootform exposes no username, password,
or token flag and persists no credential. OCI Distribution has no mandatory
atomic compare-and-swap tag write: client preflight plus final verification
detects observed races, while absolute exclusion of late competing writers
requires registry-side immutable tags or serialized publishers.

## Exact source selection

`rootform.lock` is sole project-selection contract. Each third-party Dialect
names one relative local directory or one tagless OCI repository with exact
manifest and layer digests and bounded sizes. `rootform init` verifies those
pins and may acquire only a missing exact OCI package; it never enumerates a
registry, resolves a tag or version, detects providers, selects a Dialect, or
writes the lock. `check` performs no acquisition and no network access.

## Integrity and installation

Every OCI descriptor uses SHA-256 and declared size. Client verifies descriptor,
OCI shape, strict manifest, archive bounds, extracted content, then recompiles
semantic and presentation identities before installation becomes visible.
Installation stages beneath Rootform temporary home and atomically renames to
immutable `dialects/<owner>/<version>`. Existing same-version content must
match exact acquisition identity; it is never silently replaced.

Cache data is a reproducible acquisition input, not a trust anchor. Corrupt,
incomplete, unexpected, or same-version changed content fails closed.

One active unit per owner. A collision without an explicit replacement is an
error. A packaged Dialect incompatible with the expected RF Language or RF
Vocabulary contract is refused at load time with expected and observed
identities in the diagnostic. There is no partial load and no fallback.

Lifecycle ownership for dialect packages:

```text
VCS                -> authoring
OCI                -> dialect distribution
rootform.lock      -> exact selection
.rootform/dialects -> vendored execution for selected Dialects
store/cache        -> materialization and offline reuse
Docker credentials -> private registry authentication
```

Git or another VCS supplies optional human provenance. Execution never depends
on VCS. Rootform Cloud or managed registry is not required.

Related contracts:

- [`rootform-lock.md`](rootform-lock.md);
- [`rootform-oci-core-profile.md`](rootform-oci-core-profile.md);
- [`../docs/offline-security.md`](../docs/offline-security.md).
