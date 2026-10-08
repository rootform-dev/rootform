---
title: Compatibility and versions
description: Version boundaries for commands, saved Forms, Policies, and semantic packages.
---

Rootform versions its executable separately from its data formats, Dialects,
Policy Packs, Go module, Action, and editor extensions. A binary version does
not change those versions automatically.

## Commands and machine output

During 0.x, a minor release may change a documented command or contract. Its
release notes identify incompatible changes and the required migration. A
patch fixes behavior under the existing contract; it does not intentionally
remove a command, flag, output field, or supported syntax.

The [command reference](reference/cli/index.md) defines accepted arguments.
[Outputs and exit status](reference/outputs.md) defines output ownership and
statuses `0` through `4`. Use machine output for automation; human prose and
visual layout are presentation, not a parsing interface. An indeterminate
Policy result is never a successful check.

A stable major release must preserve its documented command arguments, exit
semantics, default machine formats, and supported syntax within that major.
An intentional incompatible change requires a new major release. This rule
does not turn the current RF authoring development contract into a stable
language promise.

## Saved documents

Form, Policy result, and `rootform.lock` use format `"1"`. Compiled Policy
Packs use `"v1"`; those are different format families. Readers reject unknown
fields and unsupported versions. A new field or enum value is not automatically
compatible with an existing strict reader.

A wire change that an existing reader cannot accept needs a new format family
and migration notes. Changing the default machine format is also a binary
compatibility change. Valid saved Forms retain their recorded semantics and
provenance when reopened; they are not reanalyzed with newer Rules. Analysis
does not rewrite a project's lock.

See the [public contracts](../contracts/README.md),
[Forms](concepts/forms.md), and [locked selections](offline-security.md).

## Dialects and Policy Packs

Each package has its own semantic version and exact content digest. A published
version always identifies the same bytes. The binary's embedded release set
records which Dialects it supplies; project selections pin external content.

- A patch corrects behavior to match the package's existing documented meaning.
  A correction can change facts or verdicts. Release notes identify the defect,
  affected inputs, and changed results; fixture diffs establish the correction.
- A minor release adds supported input, Rules, or Policies without redefining
  existing declared meaning. New coverage can replace an indeterminate result
  with a decision, or change what a Policy observes. Document those effects.
- An intentional change to existing meaning, a removed or renamed public
  symbol, or incompatible authoring syntax requires a new major package
  version. During package 0.x, use a new minor version and migration notes.

A verdict change alone does not distinguish a bug fix from a contract change.
Review the declared meaning and the before/after evidence. A changed golden
file is evidence to review, not permission to accept new semantics.

For reproducible comparisons, keep the binary, selection, and package digests
fixed. Compiled Policies retain their semantic pins; an incompatible selection
is refused rather than interpreted as a pass.

## Independent integrations

The [Go CLI module](../cli/README.md) remains a v0 API without a compatibility
promise. RF authoring follows its [development contract](../contracts/rootform-language.md).
Neither is silently promoted by a binary version change.

The Action versions its inputs and outputs independently; its `version` input
pins the Rootform executable. Editor extensions version their settings and LSP
transport independently and use an explicitly installed compatible CLI. Store
publication and supported integration matrices do not follow a binary version
automatically.
