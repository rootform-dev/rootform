# Concepts

Rootform reads Terraform and OpenTofu as evidence and compiles architecture
meaning through local versioned dialects.

Rootform separates architecture semantics from architecture governance:

- Dialects define architecture semantics: what a declaration means;
- Policy packs define architecture governance: which meanings are acceptable;
- A policy always belongs to exactly one policy pack and never to a dialect;
- A project evaluates only policy packs recorded in its lock or named
  explicitly; packs are never auto-selected.

- Terraform remains source of truth and is never modified.
- Every discovered declaration receives explicit outcome.
- References and dependencies are evidence, not automatic architecture edges.
- Architecture IR separates semantic meaning from renderer instructions.
- Provenance backs non-trivial conclusions.
- Unknown input remains visible.
- Equivalent inputs, configuration, and dialects produce equivalent output.

Rootform works offline after binary, required dialects, and selected policy
packs are installed. It has no telemetry, call-home, CDN, cloud account, or
provider runtime requirement.
