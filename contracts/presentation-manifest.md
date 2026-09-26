# Presentation manifest contract

Current format version: `1`.

A Dialect may contain one `presentation.json`. It maps normalized source
identities and optional local Rule or Concept names to declarative
`family/name` technology identities and plain-text labels.

This independence is normative: a resource without any Rule or Concept may
possess its own presentation identity and icon, and a catalog with many icons
does not require an equivalent Rule catalog. An icon is never a classification,
evidence, or policy contract.

Sections are `resources`, `rules`, `concepts`, `resource_labels`,
`rule_labels`, and `concept_labels`. Missing sections mean empty objects.
Resource sections are independent from Rules: they map exact normalized keys
such as `resource/aws_vpc` or `data/aws_ami`. Rule and Concept sections use
unqualified local names owned by this Dialect.

Resource keys begin with source kind `resource`, `data`, `ephemeral`, or
`action`, then slash and exact normalized type. Local names are bounded
lowercase kebab-case. Identity values are bounded lowercase kebab-case
`family/name` strings.

Labels are trimmed non-empty UTF-8 up to 256 bytes. Markup, URLs, styles,
executable schemes, control characters, and bidirectional controls are
forbidden. Whole manifest is at most 64 KiB. Unknown fields and trailing JSON
are rejected.

Manifest never carries SVG, HTML, asset URL, color, size, layout, or behavior.
It does not enter semantic artifacts, semantic digest, Architecture IR, diff,
or policy input. A presentation-only content change may alter the delivered
bytes without changing any semantic contract or policy pin.

Resolved manifests merge into deterministic catalog. Rule keys become exact
`owner.rule.name` identities and Concept keys become exact
`owner.concept.name` identities; source identities remain normalized kind/type
keys and conflicting owners warn deterministically. Architecture IR retains
source metadata needed for lookup and never embeds SVG assets. Invalid manifest
is ignored with warning during normal run; authoring and release validation
reject it.

The catalog served by `run` and embedded in an HTML export also includes a
neutral identity and label for each built-in RF Vocabulary Concept:

| Concept | Presentation identity |
| --- | --- |
| `rf.concept.kubernetes-cluster` | `kubernetes/cluster` |
| `rf.concept.managed-database` | `generic/database` |
| `rf.concept.object-storage-container` | `generic/storage` |
| `rf.concept.service-identity` | `generic/identity` |
| `rf.concept.subnet` | `generic/subnet` |
| `rf.concept.virtual-network` | `generic/network` |

An external endpoint for an RF Vocabulary Concept has that Concept and no
Rule, so its presentation can use this catalog entry. No Dialect manifest owns
an `rf` key. These entries are added when building the run catalog; they are
absent from Dialect package catalogs and do not change a Dialect package
digest.

Machine schemas:

- [`../schemas/presentation-manifest.schema.json`](../schemas/presentation-manifest.schema.json)
- [`../schemas/presentation-catalog.schema.json`](../schemas/presentation-catalog.schema.json)
