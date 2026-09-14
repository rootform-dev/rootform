---
title: "Project selection and preparation"
description: "Use the embedded release set, prepare explicit selections, and see what a project resolves."
---

Rootform embeds RF Vocabulary and supplied [Dialects](concepts/dialects.md) in
its binary as one release set. A project that uses only supplied content needs
no `rootform init`, no `rootform.lock`, and no network access.

## Normal commands

```sh
rootform build . --output architecture.json
rootform check .
```

`build`, `run`, and `check` never download, acquire, prompt, or discover
content. They use the embedded release set and read `rootform.lock` only when
the project has one. Without a lock, a project selects no Policy Packs.

Terraform and OpenTofu provider versions stay in the configuration and
`.terraform.lock.hcl`. They never enter `rootform.lock`.

## When a project needs a lock

Add `rootform.lock` to select content outside the release set:

- a third-party Dialect;
- a whole-owner exclusion or replacement of a supplied Dialect;
- a Policy Pack.

Every entry is exact: owner or pack name, version, content digest, and a
relative local path or a complete OCI identity. Rootform never discovers these
selections from a provider or a registry, so the lock must already name them,
and no Rootform command writes it. The format is `1`. The
[third-party content guide](guides/external-content.md) defines the entry
shape, and [Locks and offline operation](offline-security.md) covers digests
and offline transfer.

## Prepare an explicit selection

```sh
rootform init . --locked --no-input
```

`init` verifies every existing selection and may fetch only the exact OCI
manifest digests already recorded in the lock. It never creates, edits, or
re-resolves the lock, and it never changes the embedded release set.
`--offline` restricts preparation to content already present locally.

## Vendor content into the project

```sh
rootform vendor dialects
rootform vendor policy-packs
```

`vendor` copies selected non-embedded content into `.rootform/dialects` and
`.rootform/policy-packs`. When one of those directories exists it is the only
execution source for that kind; missing or changed content fails instead of
falling back to the shared store or a registry. RF Vocabulary and supplied
Dialects are embedded, so they are never installed or vendored.

## Policy selection

`build` and `run` ignore Policy Packs, so governance never changes
Architecture IR. `check` evaluates the packs recorded in the lock, or an
explicit source for one invocation:

```sh
rootform check . --policy-pack ./policies
```

`--policy-pack` accepts a source directory or a compiled pack file, and it
cannot be combined with `--locked`. It does not add the pack to the lock or
install it. A project with no pack selection evaluates zero policies, which is
never compliant.

## Inspect the effective selection

```sh
rootform list dialects
rootform list policy-packs
rootform list policies
```

These commands read the embedded release set and the project selection without
network access.

Third-party content already prepared lives under `$ROOTFORM_HOME/dialects` and
`$ROOTFORM_HOME/policy-packs`. The linked Policy Pack cache under
`$ROOTFORM_HOME/cache/linked-policy-packs` is a derived artifact: Rootform
rebuilds it and never treats it as a selection or a trust anchor.

See the [CLI reference](reference/cli/index.md) for every flag,
[Add a third-party Dialect or Policy Pack](guides/external-content.md) for
publishing and selection, and [Troubleshooting](troubleshooting/index.md) when
preparation fails.
