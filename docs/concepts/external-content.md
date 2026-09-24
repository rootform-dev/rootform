---
title: "Install, add, and vendor"
description: "How Rootform separates content available on a machine from the exact dependencies of a project."
---

Rootform answers two questions separately: which Dialects and Policy Packs
exist on this machine, and which ones this project depends on. Keeping them
apart means a project's result depends on its own exact selection, never on
what else happens to be installed on the machine that runs it.

## Four states

Every Dialect or Policy Pack that Rootform can use is in one or more of these
states:

| State | Where it lives | What puts it there |
| --- | --- | --- |
| **Embedded** | inside the `rootform` binary | the Rootform release you installed |
| **Installed** | your Rootform home, `$ROOTFORM_HOME` | `rootform install`, `add`, `update`, `init`, or `vendor` |
| **Selected** | the project's `rootform.lock` | `rootform add`, `remove`, or `update` |
| **Vendored** | the project's `.rootform/` directory | `rootform vendor`, then `add`, `remove`, and `update` |

Embedded Dialects work in every project without any setup. Only content that
does not ship with Rootform, or that replaces an embedded Dialect, needs to
be selected.

The states answer different questions. Installed content is merely
available: a project never uses a Dialect because it happens to be in your
Rootform home. Selected content is a dependency: the project uses exactly the
identity recorded in `rootform.lock`, from any machine.

## Add changes the project

`rootform add` adopts content into the project in the current directory:

<!-- docs-check:external-content-1 -->
```sh
rootform add dialects ./dialects/payments
```

```text title="Example result"
rootform.lock updated

  add      dialect payments 0.1.0  (dialects/payments)
```

The example assumes a valid `payments` Dialect source at that path. Rootform
records its project-relative path and compiled content digest. The result
shows the change without printing the digest. Commit `rootform.lock` with
the source directory.

For OCI content, `add` accepts a tag or digest reference, resolves and
verifies it, installs it, and records its exact identity. The lock keeps the
repository and content digests, never a tag, so later tag changes cannot
change the project. Several
operands form one change: if any of them fails, `rootform.lock` stays as it
was.

`rootform update` moves an existing selection to another version or source,
and `rootform remove` drops it. You never need to edit `rootform.lock` by
hand or know which digest belongs in which field.

## Install prepares a machine

`rootform install` downloads and verifies OCI content into your Rootform home
without reading or changing any project:

<!-- docs-check:external-content-2 -->
```sh
rootform install dialects registry.example.com/acme/rootform/payments:0.1.0
```

The registry address is illustrative. Replace it with a published Dialect
reference; successful installation prints the verified owner and version.

Use it to prepare a workstation, a CI runner image, or a machine that will
later work offline. You never need to run `install` before `add`, because
`add` installs what it selects. Several versions of the same Dialect can be
installed at once; each project uses only the version it selects.

`rootform list dialects --installed` shows what your Rootform home holds, and
`rootform uninstall` deletes an exact installed version.

## Init prepares a clone

On another machine, or in CI, `rootform init` makes the project's selection
present and verified:

<!-- docs-check:external-content-3 -->
```sh
rootform init --locked
```

Successful preparation prints `Project prepared` and counts of external
Dialects and Policy Packs.

`init` reads `rootform.lock` and never changes it. It downloads a missing OCI
selection only by the exact digest recorded in the lock, and `--offline`
prevents even that. After `init`, `build`, `check`, and `run` use the same
Dialects and Policy Packs as on the machine that ran `add`.

## Vendor keeps the bytes in the repository

`rootform vendor` copies every selected Dialect and Policy Pack into
`.rootform/`, so a clone carries its dependencies and needs no Rootform home
or registry access. Once `.rootform/dialects/` or `.rootform/policy-packs/`
exists, Rootform reads that family only from there and fails if it differs
from `rootform.lock`, even when a matching copy is installed. `add`, `update`,
and `remove` keep an existing `.rootform/` in step with the lock.

Vendoring is optional. Use it when builds must work without network access
and without a prepared Rootform home, or when reviewers should see dependency
bytes in the repository.

`rootform init --locked --offline` verifies an existing vendor tree against
the lock. Missing, extra, or changed vendored content fails preparation.

## Which content a command uses

For every command, Rootform builds the active set of Dialects in one fixed
order:

1. Start from the embedded Dialects.
2. Drop the embedded owners that the project excludes.
3. Add each selected Dialect, reading its bytes from exactly one place: the
   vendor tree if the project has one, otherwise the recorded local path,
   otherwise the installed copy with the recorded digests.
4. Apply `--dialect` overrides given to this command.

For Policy Packs, `--policy-pack` overlays one pack by name for one command;
other selected packs remain active. An override never changes the lock. Two
overrides with the same owner or pack name fail. `--locked` rejects overrides.

A missing or different copy stops the command. Rootform never falls back from
the vendor tree to your Rootform home, from a local path to an installed copy,
or from one version to another, and `build`, `check`, and `run` never use the
network. The same order applies to Policy Packs, without an embedded start.

## Embedded Dialects change only by project decision

Installing a Dialect whose owner matches an embedded Dialect, such as a fork
of `aws`, changes nothing. A project replaces an embedded Dialect only when
you say so:

<!-- docs-check:external-content-4 -->
```sh
rootform add dialects ./dialects/aws --replace
```

`rootform remove dialects aws` later drops the replacement and makes the
embedded `aws` active again. To stop using an embedded Dialect altogether,
run `rootform remove dialects aws --embedded`; `rootform add dialects aws`
brings it back.

## Policy Packs are the unit you select

Policies are installed, selected, and vendored only as part of their Policy
Pack. A Policy's identity, version, and evaluation context come from its pack,
so a Policy on its own has nothing exact to record. To evaluate part of a
selected pack, filter the run with `--policy`. This command reports only
the results of the Policies in the `tutorial` pack:

<!-- docs-check:external-content-5 -->
```sh
rootform check . --policy 'tutorial/*'
```

This example assumes the project selects a `tutorial` Policy Pack. The check
reports the selected Policies' results and exits according to their outcomes.

The filter lasts for that run; `rootform.lock` still selects the whole pack.
A project that always needs a smaller set should select a smaller pack.

## Next

- [Use a local Dialect while authoring](../guides/local-dialect.md)
- [Add external Dialects and Policy Packs](../guides/external-content.md)
- [Where Rootform stores external content](../reference/storage.md)
