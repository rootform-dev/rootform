# Concepts

Rootform reads Terraform and OpenTofu as evidence and compiles architecture
meaning through local versioned dialects.

- Terraform remains source of truth and is never modified.
- Every discovered declaration receives explicit outcome.
- References and dependencies are evidence, not automatic architecture edges.
- Architecture IR separates semantic meaning from renderer instructions.
- Provenance backs non-trivial conclusions.
- Unknown input remains visible.
- Equivalent inputs, configuration, and dialects produce equivalent output.

Rootform works offline after binary and required dialects are installed. It has
no telemetry, call-home, CDN, cloud account, or provider runtime requirement.
