# Binary handoff contract

This contract governs release/freeze. During dev integration, Rootform may
consume an allow-listed public export and deterministic transient executable
from a clean exact Engine commit, with commit and SHA-256 recorded. Such inputs
support local integration only; release assembly and publication still require
the immutable handoff below.

Rootform release tooling accepts one content-addressed producer handoff. It
never reads producer source or a producer repository.

The handoff carries the Rootform release set: the exact RF Vocabulary and every
supplied Dialect execution travels together with the binaries, and its identity
is recorded in the package manifest for this handoff generation. The release
set is selected and upgraded as one unit; Rootform never checks out, packages,
publishes, installs, or vendors those units separately. Rootform consumes the
release set from the handoff; it does not produce or repackage it.

## Outer assets

Input directory contains exactly:

- `rootform_engine_handoff_<version>.tar.gz`;
- `ENGINE_HANDOFF_SHA256SUMS`.

Checksum record uses lowercase SHA-256, two spaces, exact filename, canonical
lexical order, and final newline. Authenticated release metadata must report
same names, byte lengths, and `sha256:` digests. Extra assets fail verification.

## Bundle inventory

Tar gzip is canonical: flat safe names, regular files only, deterministic
lexical order, normalized ownership and timestamps, mode `0755` for executables
and `0644` otherwise, two zero-block terminator, and no trailing payload.

Bundle contains exactly:

- `rootform_linux_amd64`;
- `rootform_linux_arm64`;
- `rootform_darwin_amd64`;
- `rootform_darwin_arm64`;
- `rootform_windows_amd64.exe`;
- `form.schema.json`;
- `engine-sbom.spdx.json`;
- `engine-handoff.json`;
- `SHA256SUMS`, covering every other bundle entry.

## Producer manifest

`engine-handoff.json` format version 2 binds exact product version, producer
source identity, exact private renderer repository/revision/release identity,
renderer archive name/size/hash, renderer manifest name/hash, deterministic
build time, toolchains, build settings, five-target file/size/hash records,
schema hash, release-set identity (RF Vocabulary and every supplied Dialect
with owner, kind, version, content digest, and semantic digest), and SBOM hash.
Renderer names must derive from its exact revision. JSON keys and arrays are
canonical. Unknown fields fail.

The `release_set` field contains an envelope with exactly `format_version: "1"`
and `release_set`. The nested object has exactly `id`, `manifest_digest`, `units`
and `version`, matching the public Form `ReleaseSet` model. Each unit has exactly
`content_digest`, `kind`, `owner`, `semantic_digest` and `version`. Release-set
and unit versions use SemVer. Units have unique canonical owner names and
ascending owner byte order.
Exactly one unit has owner `rf` and kind `vocabulary`; all other units have kind
`dialect`. Content and semantic digests use `sha256:` followed by 64 lowercase
hexadecimal characters.

Identity follows the public `ReleaseSetIdentity` algorithm. Join the release-set
version, followed by each ordered unit's owner, kind, version, content digest and
semantic digest, with NUL bytes and no trailing separator. SHA-256 of those UTF-8
bytes supplies both `id: "release-set:<hex>"` and
`manifest_digest: "sha256:<hex>"`. Rootform recomputes and verifies both values.
RF Language uses format `1`, bound by the exact public Form schema; this envelope
contains no separate RF Language SemVer or contract digest.

The final release-set manifest SHA-256 hashes the complete canonical envelope,
including its format version, identity and units, as two-space-indented JSON with
one final newline. This envelope checksum is separate from the NUL-derived Form
identity. Handoff format remains `2`; final release manifest format remains `1`.

Producer manifest remains handoff evidence. Final release does not redistribute
it or private renderer provenance; final manifest records only its SHA-256.

## Verification

Rootform rejects handoff unless:

- outer and inner inventories and checksums are exact;
- authenticated asset metadata matches downloaded bytes;
- target set, OS, architecture, modes, sizes, and hashes are exact;
- every executable contains requested version and host executable reports
  exactly `rootform <version>`;
- schema bytes equal the committed public Form schema;
- every executable records the same public CLI module version, a
  pseudo-version naming a commit of this repository at its exact commit time;
  that commit is an ancestor of the distribution commit, `cli/` and `dialects/`
  are unchanged since it, and the runtime license inventory records its
  Dialects; any other Dialect bundle the inventory records comes from an
  ancestor commit with identical Dialects;
- SBOM is canonical SPDX 2.3 JSON for requested version and contains no private
  repository URL, renderer identity, or local filesystem path;
- no duplicate, unsafe, linked, irregular, unexpected, or trailing entry exists.

After verification, Rootform may add distribution-owned license, notices,
manifest, and checksums. Executable contents must remain byte-identical.
