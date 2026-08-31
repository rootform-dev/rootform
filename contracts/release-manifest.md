# Release manifest contract

Manifest version and product version are independent. Product versions use
exact SemVer; prerelease identifiers retain SemVer meaning.

Format version 1 binds:

- Rootform product version and exact Git tag;
- exact distribution commit owning assembly;
- exact Dialects commit used for full compatibility qualification;
- five final archive names, formats, targets, byte lengths, SHA-256 values, and
  byte-identical raw executable SHA-256 values;
- handoff bundle SHA-256 and private producer-manifest SHA-256;
- SBOM, public schema, Elastic-2.0 binary-license, third-party-notice SHA-256,
  runtime-license inventory SHA-256, and exact component count;
- final release attestation policy and current artifact-attestation availability.

Manifest does not redistribute private producer provenance or private build
toolchain detail. Handoff digests connect final evidence to retained producer
evidence without exposing its contents.

Each final archive contains executable, `ROOTFORM-BINARY-LICENSE.txt`,
`THIRD_PARTY_NOTICES.txt`, `rootform_<version>_sbom.spdx.json`, and local
`SHA256SUMS`. Archive executable must equal verified handoff executable bytes.
Manifest license metadata declares SPDX `Elastic-2.0`, status `licensed`, and
`public_release_allowed: true`; assembly fails if canonical terms drift.
Runtime inventory includes official Dialects at their exact MPL-2.0 commit and
Go runtime at its exact BSD-3-Clause toolchain version, plus every incorporated
production dependency, vendored source, or asset with verified terms.

Final release publishes five archives, standalone binary license and notices,
standalone SBOM, manifest, and `SHA256SUMS` covering every other asset. No extra
asset is accepted.

All assets attach while release is draft. Uploaded GitHub asset digests and
complete checksum file are verified before one-time publication. Published tag
and assets are immutable; correction requires new version.
