# Release manifest contract

Manifest versions use exact SemVer. Prerelease identifiers retain their SemVer
meaning.

Each release manifest binds:

- Rootform product version and Git tag;
- exact `engine` commit and exact `dialects` commit used for tests;
- Go and Bun toolchain versions;
- target operating system and architecture;
- asset name, byte length, and SHA-256;
- SBOM filename and SHA-256;
- proof status per target;
- binary license and third-party notice filenames;
- exact distribution commit supplying binary terms and release contracts.

That distribution commit is a release input. It does not need to contain the
generated candidate manifest, so provenance never creates a circular commit
dependency between `engine` and this repository.

Cross-compilation proves buildability only. A target may be marked supported
only after native or accepted CI execution. Manifest carries no timestamp in
canonical content.

Every archive contains executable, `ROOTFORM-BINARY-LICENSE.txt`,
`THIRD_PARTY_NOTICES.txt`, SBOM, and archive-local checksum record. Release page
publishes complete `SHA256SUMS` and verifies uploaded GitHub asset digests.

Published binary releases must carry final Rootform Binary License terms.
