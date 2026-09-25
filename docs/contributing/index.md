---
title: "Contribute to Rootform"
description: "Find the right place to improve Rootform or report a reproducible problem."
---

Found something to improve? Start with the repository or reporting channel that
owns it. A small, reproducible report is enough to begin a product discussion.

| Contribution or report | Destination |
| --- | --- |
| Documentation, examples, public contracts, distribution tooling | [Rootform repository](https://github.com/rootform-dev/rootform) |
| Official Dialects, Rules, and fixtures | [`dialects/`](https://github.com/rootform-dev/rootform/tree/dev/dialects) in Rootform |
| GitHub Action | [Action repository](https://github.com/rootform-dev/action) |
| Reproducible product behavior | [Public Rootform issues](https://github.com/rootform-dev/rootform/issues) |
| Suspected exploitable vulnerability | [Private vulnerability reporting](https://github.com/rootform-dev/rootform/security/advisories/new) |

Never use a public issue for an exploitable vulnerability.

## Improve a page

Use **Edit this page** to reach its Markdown source. Keep the change focused and
follow [Writing for Rootform](writing.md). Check changed commands against the
CLI and show an observable result beside each example.

For a documentation change, run from the Rootform repository:

```sh
bun install --frozen-lockfile
bun run check:docs
bun run check:format
```

Heading or anchor changes also need a check against the built documentation
site. That rendered-HTML check is separate from `bun run verify`. Follow
[CONTRIBUTING.md](https://github.com/rootform-dev/rootform/blob/dev/CONTRIBUTING.md)
for executable example verification and the complete Rootform repository gate.

## Report a semantic gap

Open a [public Rootform issue](https://github.com/rootform-dev/rootform/issues)
with the Rootform version, a small synthetic example that reproduces the
surprise, what you observed, and what you expected. You do not need to classify
the internal accounting or know content digests before reporting it.

When relevant, add the provider and version, active Dialect, diagnostic,
and provider documentation that supports the expected interpretation. Never
include credentials, customer data, state, real plans, or private paths.

To contribute a Rule to an official Dialect, follow
[Write a Dialect](../dialect-authoring.md). Include provider documentation,
a reproducible fixture, and the behavior it proves under
[`dialects/`](https://github.com/rootform-dev/rootform/tree/dev/dialects).
A provider-version change needs evidence, not a guessed mapping.

Teams can [write their own Policy Packs](../language/write-policy-pack.md).
Public examples illustrate authoring patterns; they are not an official or
community governance catalog.

## Discuss contract changes first

Open an issue before changing a public wire format, CLI contract, release
convention, license, or security behavior. Contract text and executable checks
must change together. Generated schemas are not hand-edited.

The repository's [root license](https://github.com/rootform-dev/rootform/blob/dev/LICENSE)
covers source, documentation, contracts, examples, and tooling under
Apache-2.0. Official Dialects under
[`dialects/`](https://github.com/rootform-dev/rootform/tree/dev/dialects) have their own
[MPL-2.0 license](https://github.com/rootform-dev/rootform/blob/dev/dialects/LICENSE).
Distributed Rootform executables carry an
[Elastic-2.0 notice](https://github.com/rootform-dev/rootform/blob/dev/dependencies/ROOTFORM-BINARY-LICENSE.txt).

For reporting instructions, see the
[security policy](https://github.com/rootform-dev/rootform/blob/dev/SECURITY.md).
