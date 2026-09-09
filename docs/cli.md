---
title: "Project preparation"
description: "Understand when Rootform initializes a project, reuses a lock, or asks for an explicit update."
---

Before compiling a directory, Rootform needs the Dialects that interpret its
providers. `build`, `run`, and directory-based `check` share this preparation.
You can also prepare explicitly with `rootform init`.

## The first command

```sh
rootform run .
```

From a new supported project, Rootform discovers providers, proposes a compatible
selection, downloads verified packages when needed, and writes `rootform.lock`.
It then resumes the requested command. Interactive preparation shows the proposal
before you confirm it.

For a deterministic unattended first selection:

```sh
rootform init . --no-input
```

No-input mode accepts only an unambiguous selection. `ROOTFORM_INPUT=0`,
`CI=true`, and initialization's JSON output also disable prompts. They do not
make the command offline.

## An existing project

When the lock and required local packages are coherent, preparation is a silent
path with no network access. A missing exact locked artifact can be recovered
from its recorded repository without changing the lock.

A normal no-input command never silently changes an existing lock. If provider
requirements or other project inputs need a new selection, it stops and reports
an explicit initialization command. Run that command deliberately, review the
lock diff, and retry the original task.

Use `init --upgrade` only when you intend to revisit compatible versions. Use
`--locked` when the existing selection must remain unchanged, and add `--offline`
when no download is allowed. [Reproduce a build](guides/reproduce-build.md) walks
through these choices.

## Context belongs to the selected root

For directory input, the argument is both the Terraform/OpenTofu root and the
Rootform project root. It owns `rootform.lock` and `.rootform/`; parent markers
are not inherited. `ROOTFORM_HOME` controls the installed store, not the project
boundary.

Saved architecture and plan inputs have different preparation rules. Serving a
saved architecture needs no Dialect acquisition. Plan operations require the
current project's semantics to be prepared. Checks over saved documents require
selected Policy Packs available locally. See [inputs](inputs/index.md).

## Policies are selected separately

`build` and `run` ignore Policy Packs. `check` uses the packs selected for the
project, and directory preparation can recover those selected packages.
Provider detection never chooses governance for you.

During authoring, `check --policy-pack ./policies` reads a local pack directly.
Keep that flag in CI when the pack lives in the repository; it cannot be combined
with `--locked`. Initialization's `--policy-pack` flag selects a published OCI
artifact reference and records it in `rootform.lock`, so later checks can use
`--locked`. The [policy tutorial](guides/check-architecture.md) covers both CI
paths and explains why a successful check with zero evaluations proves no
target-specific rule.

## Inspect without changing selection

```sh
rootform list dialects
rootform list policy-packs
rootform list policies
```

These listings are read-only. `list dialects --installed` reports local versions;
`--outdated` compares the lock with the cached index. Neither listing contacts
a registry or upgrades packages.

Use [CLI command reference](reference/cli/index.md) for the generated command
tree, usage, defaults, and flags. [Locks and sources](offline-security.md)
explains package identity; [troubleshooting](troubleshooting/index.md) gives
recovery steps for preparation failures.
