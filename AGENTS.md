# Rootform distribution engineering contract

## Mission

This repository is Rootform's public distribution and contract surface. It
contains no proprietary engine source. Every published document, schema,
example, release record, and artifact must be understandable and auditable
without private context.

## Boundaries

- Never add engine, renderer, server, website, or cloud source.
- Never add private specs, ADRs, prompts, transcripts, work logs, credentials,
  customer data, Terraform state, raw plans, or personal paths.
- Public contracts are normative documents owned here, not copies of private
  implementation plans.
- Generated schemas arrive only through the allow-listed engine export and are
  never hand-edited.
- Examples are synthetic and never become authoritative Terraform source.
- Release binaries use Elastic License 2.0. Apache-2.0 covers repository source,
  contracts, docs, examples, and tooling only.
- Producer handoffs are verified as opaque bytes. This repository never reads
  producer source, redistributes private producer provenance, or modifies raw
  executable contents during final assembly.
- Rootform name and marks are not licensed by Apache-2.0.

## Dependencies and release

- Cross-repository inputs use exact commits, tags, checksums, and release
  manifests. Relative paths, symlinks, and worktree assumptions are forbidden.
- Rootform owns final archive assembly, official Dialects compatibility,
  release checksums, and publication. Action consumes published releases only.
- Bun is the only JavaScript package manager.
- GitHub Actions use full commit SHAs.
- No release, package, site, Marketplace listing, or visibility change occurs
  without explicit owner authorization.

## Validation

Run:

```bash
bun run verify
```

Completion requires contract/schema validation, runnable examples, release
metadata and license checks, secret scans, full-history review, and a clean
diff.
