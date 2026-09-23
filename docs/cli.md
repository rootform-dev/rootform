---
title: "Select Dialects and Policy Packs"
description: "Decide whether a project needs Rootform configuration and inspect its effective selection."
---

Most projects need no Rootform configuration. Rootform embeds RF Vocabulary and
the supplied [Dialects](concepts/dialects.md) in its binary. Add project
configuration only when you need content outside that embedded release set or
want to change which embedded Dialect owners are active.

| Situation | Project configuration |
| --- | --- |
| Build or explore with embedded Dialects | None. Run `build` or `run` directly. |
| Evaluate one local Policy Pack | Pass `--policy-pack` for that invocation. No lock is required. |
| Keep an external Dialect or Policy Pack selected for the project | Record its exact identity in `rootform.lock`, then prepare it with `init`. |
| Exclude or replace an embedded Dialect owner | Record the exclusion or replacement in `rootform.lock`. |

## Use embedded Dialects

<!-- docs-check:selection-embedded-build -->
```sh
rootform build . --output architecture.json
```

No `rootform.lock` or `rootform init` is needed. Inspect one embedded Dialect:

<!-- docs-check:selection-embedded-list -->
```sh
rootform list dialects --dialect aws -o wide
```

```text title="Embedded Dialect"
NAME  VERSION  ORIGIN    CONCEPTS  CONTEXTS  RELATIONS  RULES
aws   0.1.0    embedded        64         0          1    108
```

## Run one local Policy Pack

Use an explicit local pack when selection is temporary or the pack is being
reviewed. The [Run checks](guides/check-architecture.md) tutorial creates a
pack at `./policies`:

```sh
rootform list policy-packs --policy-pack ./policies -o wide
rootform list policies --policy-pack ./policies -o wide
rootform check . --policy-pack ./policies
```

The two list commands show the pack and its policies before evaluation. Check
status depends on matching targets and results. Without `--policy-pack` or a
project selection, `rootform check .` selects no policies and returns status
`3`, not compliance.

An explicit local pack does not create a lock, install content, or change the
project selection.

## Keep external content selected

Use `rootform.lock` when a project must retain an external Dialect or Policy
Pack selection across commands and environments. The lock records exact
Rootform content identities and their local or OCI origins. It does not pin
Terraform or OpenTofu providers. Provider versions remain in source and
`.terraform.lock.hcl`.

A lock can select Dialects without selecting any Policy Pack. Its presence
does not mean that `check` evaluates a policy. Inspect the current project:

```sh
rootform list dialects -o wide
rootform list policy-packs -o wide
rootform list policies -o wide
```

These commands read only local project state. Follow
[Use external Dialects and Policy Packs](guides/external-content.md) to adopt
reviewed local or OCI content. [Locks and vendored content](offline-security.md)
explains what the lock fixes and where selected content is read.

## Exclude or replace an embedded owner

An exclusion removes one embedded Dialect owner's architecture knowledge from
the effective catalog. A replacement selects another Dialect with that same
owner and explicitly authorizes the collision. Both choices belong in
`rootform.lock`. Reserved owner `rf` cannot be excluded or replaced.

Use these controls only as deliberate project decisions. See
[external content](guides/external-content.md#exclude-or-replace-an-owner) for
the exact fields, then use
[Reproduce a build offline](guides/reproduce-build.md) when the selection must
move to another environment.
