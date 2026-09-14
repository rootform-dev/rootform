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
- `architecture-ir.schema.json`;
- `engine-sbom.spdx.json`;
- `engine-handoff.json`;
- `SHA256SUMS`, covering every other bundle entry.

## Producer manifest

`engine-handoff.json` format version 2 binds exact product version, producer
source identity, exact private renderer repository/revision/release identity,
renderer archive name/size/hash, renderer manifest name/hash, deterministic
build time, toolchains, build settings, five-target file/size/hash records,
schema hash, release-set identity (RF Language contract, RF Vocabulary
identity and contract digest, and every supplied Dialect with owner, version,
content digest, and semantic digest), and SBOM hash. Renderer names must derive
from its exact revision. JSON keys and arrays are canonical. Unknown fields
fail.

Producer manifest remains handoff evidence. Final release does not redistribute
it or private renderer provenance; final manifest records only its SHA-256.

## Verification

Rootform rejects handoff unless:

- outer and inner inventories and checksums are exact;
- authenticated asset metadata matches downloaded bytes;
- target set, OS, architecture, modes, sizes, and hashes are exact;
- every executable contains requested version and host executable reports
  exactly `rootform <version>`;
- schema bytes equal committed public Architecture IR schema and export digest;
- SBOM is canonical SPDX 2.3 JSON for requested version and contains no private
  repository URL, renderer identity, or local filesystem path;
- no duplicate, unsafe, linked, irregular, unexpected, or trailing entry exists.

After verification, Rootform may add distribution-owned license, notices,
manifest, and checksums. Executable contents must remain byte-identical.
