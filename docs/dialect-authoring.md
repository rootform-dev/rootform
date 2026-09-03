# Dialect authoring

Clone `rootform-dev/dialects`, edit canonical files under `<name>/`,
then run:

```bash
rootform fmt --check .
rootform validate dialects .

export ROOTFORM_HOME="$(mktemp -d)"
rootform install dialects .
rootform verify dialects .
rootform test ./fixtures
```

Each dialect declares exact name, version, requirements, and provider envelope.
Cross-dialect concept and context references are explicitly qualified. A
presentation manifest may map current dialect's rule and concept names to safe
technology identities, but cannot carry assets or layout.

Distribution remains explicit:

```bash
rootform package dialects . --to artifacts/oci \
  --repository registry.example/team/dialects \
  --source-url https://example.com/team/dialects \
  --revision 0123456789abcdef0123456789abcdef01234567 \
  --documentation-url https://example.com/team/dialects/docs \
  --licenses MPL-2.0
rootform publish dialects artifacts/oci \
  --to registry.example/team/dialects --index
```

Package step is offline. Publish step uses Docker-compatible registry
credentials, refuses changed existing version tags, and reports success only
after exact digest repull and full verification. Direct dialect publication
does not require index; omit `--index`. Registry portability requires only
[`rootform-oci-core-v1`](../contracts/rootform-oci-core-profile.md); catalog,
Referrers, delete, signatures, SBOM, and VCS access are optional.

Provider semantic changes need current primary-source evidence, synthetic
positive and boundary fixtures, updated expected architecture, deterministic
repeat proof, and presentation coverage.
