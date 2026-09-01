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

Provider semantic changes need current primary-source evidence, synthetic
positive and boundary fixtures, updated expected architecture, deterministic
repeat proof, and presentation coverage.
