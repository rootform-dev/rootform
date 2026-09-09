---
title: "Contribute to Rootform"
description: "Improve public documentation, examples, contracts, Dialects, and the GitHub Action."
---

Public contributions can improve Rootform's documentation, examples, contracts,
distribution tooling, official Dialects, and the GitHub Action. Pick the
repository that owns the change.

| Change | Public repository |
| --- | --- |
| Docs, examples, contracts, distribution | [Rootform](https://github.com/rootform-dev/rootform) |
| Provider semantics and their fixtures | [Dialects](https://github.com/rootform-dev/dialects) |
| GitHub Action behavior | [Action](https://github.com/rootform-dev/action) |

Compiler and renderer source are private. Report reproducible product problems
in the public Rootform repository.

## Improve a page

Use **Edit page** to reach its Markdown source. Make the smallest change
that resolves the reader's problem. Follow [Writing for Rootform](writing.md),
check linked commands against `--help`, and keep the example's expected result
next to the command.

For a documentation change, run from the Rootform repository:

```sh
bun install --frozen-lockfile
bun run check:docs
```

For complete repository checks, follow the
[contribution contract](../../CONTRIBUTING.md).

## Report a semantic gap

Include the Rootform version, exact selected Dialects, a small synthetic input,
the observed accounting or diagnostic, and the result you expected. Explain
which provider documentation supports the expectation. Remove customer data,
credentials, state, raw plans, and personal paths.

To change provider semantics, follow [Write a Dialect](../dialect-authoring.md)
and contribute rules and fixtures to the Dialects repository. A provider-version
change needs evidence, not a guessed mapping.

Teams can [write their own Policy Packs](../language/write-policy-pack.md).
Public examples illustrate authoring patterns; they are not an official or
community governance catalog.

## Discuss contract changes first

Open an issue before changing a public format, CLI contract, release asset
convention, license, or security behavior. Contract text and executable checks
must change together. Generated schemas are not hand-edited.

Repository documentation and tooling use Apache-2.0. Official Dialects use
MPL-2.0. Distributed Rootform executables use Elastic License 2.0; the public
repository license does not relicense the binary.

For a vulnerability, use the [private reporting route](../../SECURITY.md).
