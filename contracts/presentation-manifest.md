# Presentation manifest contract

Current format version: `1`.

A dialect may contain one `presentation.json`. It maps dialect-owned rule and
concept names to declarative `family/name` technology identities and optional
plain-text labels.

Sections are `rules`, `concepts`, `rule_labels`, and `concept_labels`. Missing
sections mean empty objects. Keys are unqualified lowercase kebab-case names
owned by current dialect. Identity values are bounded lowercase kebab-case
`family/name` strings.

Labels are trimmed non-empty UTF-8 up to 256 bytes. Markup, URLs, styles,
executable schemes, control characters, and bidirectional controls are
forbidden. Whole manifest is at most 64 KiB. Unknown fields and trailing JSON
are rejected.

Manifest never carries SVG, HTML, asset URL, color, size, layout, or behavior.
It does not enter semantic artifacts, semantic digest, Architecture IR, diff,
or policy input.

Resolved manifests merge into deterministic presentation catalog keyed by
qualified `dialect/name`. Invalid manifest is ignored with warning during a
normal product run; authoring and release validation must reject it.

Machine schemas:

- [`../schemas/presentation-manifest.schema.json`](../schemas/presentation-manifest.schema.json)
- [`../schemas/presentation-catalog.schema.json`](../schemas/presentation-catalog.schema.json)
