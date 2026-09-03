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
