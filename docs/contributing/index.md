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
| Command line: commands, flags, help, reports, exit statuses | [`cli/`](https://github.com/rootform-dev/rootform/tree/dev/cli) in Rootform |
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
bun scripts/ci/run.ts docs
bun run check:format
```

Heading or anchor changes also need a check against the built documentation
site. That rendered-HTML check is separate from `bun run verify`. Follow
[CONTRIBUTING.md](https://github.com/rootform-dev/rootform/blob/dev/CONTRIBUTING.md)
for executable example verification and the complete Rootform repository gate.
It also explains the [impact-selected PR checks](https://github.com/rootform-dev/rootform/blob/dev/CONTRIBUTING.md#pull-request-checks),
documentation previews and progress after merge. Prose-only changes do not run
CLI tests or build the Playground.

Your PR keeps one progress comment, mirrored by its `Contribution delivery`
check. It follows the newest commit and reports each stage separately:

| Row | What it reports |
| --- | --- |
| Public validations | The checks selected for your change, on the newest commit |
| Documentation preview | The rendered pages of that commit, when the change affects pages |
| Development integration | After merge, the documentation, Playground and command line consuming your change on their development branches, for the parts it touches |
| Staging sites | After merge, the staging sites serving your change |
| Release | The first published Rootform release that includes your change |

A newer commit replaces the results of an older one. Before merge, the last
three rows read "Starts after merge"; a PR closed without merge reads "Closed
without merge", because nothing was integrated, staged or released. A stage
that stops progressing reads "Timed out" until a maintainer comments
`/rootform retry`, which resumes it on a new check.
Failures link to public checks or name the content error, so you never need
access to another repository to understand a result. Generated reference
failures include the expected output diff as a public artifact. Forks use the
same contribution path, with the repository's workflow approval policy
preserved.

After merge, applicable content and runtime consumers advance through their own
checks. Documentation can reach staging independently of Playground scenarios
and runtime compatibility. Progress and failures remain on the public source
PR. A merge into development does not publish a production site or a release.
Maintainers later promote `dev` to `main` through a pull request checked on
the exact promoted commit, and releases are prepared from `main` only. See
[branches and promotion](https://github.com/rootform-dev/rootform/blob/dev/CONTRIBUTING.md#branches-and-promotion).

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

## Contribute to the command line

The Rootform command line is the open-source Go module
[`cli/`](https://github.com/rootform-dev/rootform/tree/dev/cli), under
Apache-2.0. It owns the commands, flags, help, completions, argument checks,
exit statuses, human and machine reports, the loopback Explorer server, and
the HTML export, plus the Form and Policy result models and their schemas.
Compilation, Rule evaluation, Policy evaluation, and comparison live in a
private engine that implements the module's backend ports; a contribution to
`cli/` changes how results are asked for and reported, not what they contain.

The module's [README](https://github.com/rootform-dev/rootform/blob/dev/cli/README.md)
explains how to run its tests and the conformance suite with a fake backend.
It makes no compatibility promise yet: its version is the commit the engine
pins, so open an issue before proposing a change to a command's contract.

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

A failed integration keeps the original public validation results available on the source PR.

Review the exact-source documentation preview from the contribution progress comment before merging.
