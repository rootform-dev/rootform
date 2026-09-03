# Dialect distribution contract

Current distribution format version: `1`.

Rootform dialects use OCI image manifests and content-addressed blobs.
This document defines wire compatibility; it does not claim that any registry
artifact has been published. Official origin is
`ghcr.io/rootform-dev/dialects` when publication is authorized.

## Dialect artifact

One dialect version is an OCI 1.1 artifact with:

- artifact type `application/vnd.rootform.dialect.v1`;
- config media type
  `application/vnd.rootform.dialect.manifest.v1+json`;
- exactly one layer with media type
  `application/vnd.rootform.dialect.layer.v1.tar+gzip`.

Config JSON is strict and canonical. It contains format version, dialect name
and version, exact dependencies, covered provider sources and compatibility
constraints, layer digest, semantic digest, presentation digest, download
size, install size, and file count. Requirement and provider arrays use
canonical lexical order.

Layer is deterministic gzip over deterministic tar. Entries are regular files
with normalized mode, ownership, and timestamps. Allowed content is limited to:

- Rootform dialect sources: `*.rf` and `*.rf.json`;
- one `presentation.json`;
- license and notice text named `LICENSE*`, `NOTICE*`, or
  `THIRD_PARTY_NOTICES*`.

Paths must be clean relative slash-separated paths. Absolute paths, traversal,
backslashes, duplicates, symlinks, hard links, devices, sockets, and other
irregular entries are invalid. SVG, HTML, CSS, URLs, and arbitrary executable
content are outside this boundary.

Limits are 16 MiB compressed, 64 MiB installed, 4 MiB per file, and 512 files
per dialect artifact. Declared digest, byte size, installed size, file count,
name, version, dependency, provider, semantic, and presentation identities
must all match fetched and compiled content.

## Dialect index

Dialect index is another OCI 1.1 artifact:

- artifact type `application/vnd.rootform.dialect-index.v1`;
- config media type
  `application/vnd.rootform.dialect-index.config.v1+json`;
- exactly one JSON layer with media type
  `application/vnd.rootform.dialect-index.v1+json`;
- official discovery tag `official-index-v1`.

Index JSON contains repository identity, every available dialect version,
dependencies, provider compatibility, semantic and presentation digests, file
count, artifact repository, manifest and layer digests, and byte sizes. Provider
recommendations are generated from indexed dialect provider declarations. A
recommendation absent from dialect metadata makes index invalid; no handwritten
provider-to-dialect table is accepted.

Index arrays are canonical and deterministic. An additional index artifact may
live in repository different from dialect repository declared by its content;
every dialect within one index still names that single declared repository.
Index supports discovery and recommendations only. An already locked and
installed project compiles without index. Exact locked acquisition resolves
artifact manifest by digest, not mutable dialect tag. Client is created from
each lock entry's tagless `artifact.repository`; official repository is not
required and multiple repositories may coexist in one lock. Source provenance
is never registry routing for locked artifacts.

## Provenance annotations

Package author may supply standard OCI manifest annotations:

- `org.opencontainers.image.source`;
- `org.opencontainers.image.revision`;
- `org.opencontainers.image.documentation`;
- `org.opencontainers.image.licenses`.

Rootform applies same explicit values to every dialect and index manifest in
one layout. URLs are canonical HTTPS without credentials, query, or fragment;
revision and license text are bounded. Values are informational and participate
in manifest digest because annotations are manifest bytes. Rootform does not
discover Git state, invoke VCS, add machine paths, or invent current timestamps.
Manifest digest remains technical identity.

## Generic publication

Packaging and publication are separate:

```text
rootform package dialects SOURCE --to LAYOUT --repository REPOSITORY
rootform publish dialects LAYOUT --to REPOSITORY
rootform publish dialects LAYOUT --to REPOSITORY --index
```

Package command is local and offline. Publish command accepts one existing
validated Rootform OCI layout and one canonical tagless repository matching
repository embedded in index. Dialect identity and version come only from
compiled package content. Destination tags are
`dialect-<name>-<version>`; no identity, version, or tag override exists.

Publisher validates complete local layout and compiled dependency closure
before creating registry client. It preflights every requested immutable tag
before first write. Existing exact digest is idempotent; differing digest
fails. Missing dialect graphs publish in canonical order, resolve by expected
digest, repull by manifest digest, and pass complete manifest, config, layer,
archive, dependency, semantic, and presentation verification before success.

`--index` publishes generated index only after every dialect passed remote
verification. Index tag is `index-sha256-<manifest-hex>` and is repulled and
verified last. Generic publisher never moves mutable `official-index-v1`;
official discovery remains separate publisher responsibility. `--dry-run`
performs complete local validation and reports exact tags, digests, sizes, and
provenance without reading credentials or contacting registry.

Publication reuses same Docker configuration, credential-helper, Basic, and
Bearer path as acquisition. Rootform exposes no username, password, or token
flag and persists no credential. OCI Distribution has no mandatory atomic
compare-and-swap tag write: client preflight plus final verification detects
observed races, while absolute exclusion of late competing writers requires
registry-side immutable tags or serialized publishers.

## Explicit source resolution

Official index remains implicit default. Repeatable `rootform init --source`
accepts canonical registry/repository references by tag or SHA-256 digest.
Validated artifact type determines whether source contributes one explicit
dialect root or one additional discovery index. URLs, embedded credentials,
repository-only values, unknown artifact types, registry enumeration, and VCS
resolution are rejected.

Configured indexes form unordered catalog. Equal name/version entries
deduplicate only when all semantic, presentation, dependency, provider, size,
repository, and digest metadata agree. Any difference is explicit conflict;
official/private or argument order grants no priority. Direct dialect is exact
explicit root and may satisfy compatible observed provider. Multiple distinct
compatible dialect names retain interactive ambiguity; `--no-input` refuses.
Dependencies resolve by exact name/version only within configured catalog.
Missing dependencies never trigger arbitrary registry search.

## Integrity and installation

Every OCI descriptor uses SHA-256 and declared size. Client verifies descriptor,
OCI shape, strict manifest, archive bounds, extracted content, then recompiles
semantic and presentation identities before installation becomes visible.
Installation stages beneath Rootform temporary home and atomically renames to
immutable `dialects/<name>/<version>`. Existing same-version content must match
exact acquisition identity; it is never silently replaced.

Cache and index data are reproducible acquisition inputs, not trust anchors.
Corrupt, incomplete, unexpected, or same-version changed content fails closed.

Git or another VCS supplies optional human provenance. OCI carries
distribution. Rootform indexes supply configured discovery. `rootform.lock`
pins exact selected artifact identity for reproducible project execution.
