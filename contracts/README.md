# Public contracts

These documents define Rootform's public integration surface independently of
private implementation plans.

- `rootform-language.md`: dialect source model and stable primitives;
- `architecture-ir.md`: canonical architecture document contract;
- `architecture-diff.md`: deterministic comparison result;
- `policy-result.md`: policy evaluation result;
- `rootform-lock.md`: exact dialect lock;
- `dialect-distribution.md`: OCI dialect artifacts, indexes, and explicit sources;
- `policy-pack-distribution.md`: OCI policy pack artifacts, explicit pack
  sources, and pack lifecycle ownership;
- `rootform-oci-core-profile.md`: minimal portable registry capabilities;
- `presentation-manifest.md`: dialect-owned presentation identities;
- `binary-handoff.md`: exact producer-to-distribution artifact boundary;
- `release-manifest.md`: binary release metadata and license boundary.

Contracts use format versions carried by their serialized documents. A
breaking wire change requires a new format version and migration notes. Product
version and format version are separate.
