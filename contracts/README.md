# Public contracts

These documents define Rootform's public integration surface independently of
private implementation plans.

- `rootform-language.md`: RF source model, RF Vocabulary, Dialects, Policies;
- `architecture-ir.md`: canonical Architecture IR document contract;
- `architecture-diff.md`: deterministic comparison result;
- `policy-result.md`: policy evaluation and linking result;
- `rootform-lock.md`: non-embedded selections and exclusions/replacements;
- `dialect-distribution.md`: third-party Dialect packages and
  explicit sources; supplied Dialects embedded in the release set;
- `policy-pack-distribution.md`: OCI Policy Pack artifacts, explicit pack
  sources, derived dependencies, and pack lifecycle ownership;
- `rootform-oci-core-profile.md`: minimal portable registry capabilities;
- `presentation-manifest.md`: resource-native presentation identities;
- `binary-handoff.md`: exact producer-to-distribution artifact boundary and
  Rootform release set;
- `release-manifest.md`: binary release metadata and license boundary.

Contracts use format versions carried by their serialized documents. A
breaking wire change requires a new format version and migration notes. Product
version and format version are separate.
