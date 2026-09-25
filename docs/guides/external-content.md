---
title: "Add external content"
description: "Select reviewed local or published content for a project, then prepare that selection on another machine."
---

Run selection commands from the project root. `rootform add` writes the exact
identity to `rootform.lock`; commit that file with the change that needs it.
[Install, add, and vendor](../concepts/external-content.md) explains the
states involved. For a Dialect still being edited, follow
[Use a local Dialect while authoring](local-dialect.md).

## Add local content

The [Run checks](check-architecture.md) tutorial creates a Policy Pack at
`./policies`. From that project root, adopt it after checking its results:

<!-- docs-check:external-add-local-pack -->
```sh
rootform add policy-packs ./policies
rootform init . --locked --offline --no-input
rootform list policy-packs -o wide
```

`add` compiles the pack, records its project-relative path and compiled
content digest, and creates `rootform.lock` if needed. The later commands
verify and inspect the exact selection. Commit the pack source and lock
together. Neither `add` nor `init` installs a local source in your Rootform
home. To select a local Dialect, use `rootform add dialects
./dialects/payments` from a project with that source directory.

## Add published content

Get a reviewed OCI reference from the publisher. A tag resolves once when
`add` runs; a digest reference names the artifact directly. Rootform verifies
the artifact, installs it in your Rootform home, and records its exact identity
without a mutable tag. These addresses illustrate the accepted form; replace
them with references for content you trust:

<!-- docs-check:external-add-oci -->
```sh
rootform add dialects registry.example.com/acme/rootform/payments:0.1.0
rootform add policy-packs registry.example.com/acme/rootform/baseline:0.1.0
```

Each successful change prints `rootform.lock updated` and a line naming the
added unit. Repeating the same add leaves the file untouched and prints
`rootform.lock already matches; nothing changed`. To make several additions
one project change, pass their references to one `add` command for the same
family. If a requested unit fails verification, the lock stays unchanged.

Installing an OCI unit with `rootform install` only prepares this machine;
it does not select the unit for this project. Use `add` for project adoption.

## Change or drop a selection

For a local source, edit it, then check the edited pack for one command. The
override uses the source without changing `rootform.lock`:

<!-- docs-check:external-try-local -->
```sh
rootform check . --policy-pack ./policies
```

Without the override, commands fail until you record the new content:

<!-- docs-check:external-update-local -->
```sh
rootform update policy-pack tutorial
```

An OCI selection needs a new reference because its tag was never saved. The
new reference must resolve to the same owner or pack name:

<!-- docs-check:external-update-oci -->
```sh
rootform update dialect payments registry.example.com/acme/rootform/payments:0.2.0
```

To drop a selection, use its owner or pack name:

<!-- docs-check:external-remove -->
```sh
rootform remove policy-packs tutorial
```

`remove` keeps local source files and installed copies. In a vendored project,
`add`, `update`, and `remove` also update the affected `.rootform/` family
with the lock. [Storage reference](../reference/storage.md) defines that
coupling and recovery when vendored bytes differ.

## Replace or exclude an embedded Dialect

An external Dialect with the same owner as an embedded Dialect needs explicit
replacement. This example assumes a valid local `aws` Dialect source:

<!-- docs-check:external-replace -->
```sh
rootform add dialects ./dialects/aws --replace
```

Without `--replace`, the owner collision stops before the lock changes.
Removing the replacement makes the embedded owner active again:

<!-- docs-check:external-restore -->
```sh
rootform remove dialects aws
```

To exclude an embedded owner without replacing it, use `--embedded`; add the
bare owner to include it again:

<!-- docs-check:external-exclude -->
```sh
rootform remove dialects aws --embedded
rootform add dialects aws
```

The reserved `rf` vocabulary cannot be excluded or replaced. A selected Policy
Pack that needs a Dialect symbol can prevent an incompatible removal or
replacement; Rootform checks linking before writing the lock.

## Prepare another machine or CI runner

After cloning the project, make its selected content present and verified:

<!-- docs-check:external-init-clone -->
```sh
rootform init . --locked --no-input
rootform build . --locked --output architecture.json
```

`init` may fetch only OCI digests recorded in the lock. Add `--offline` when
selected content is available at its local path, installed, or vendored and
network access must be disabled. `init` verifies an existing vendor tree,
including missing, extra, or changed content; it never rewrites
`rootform.lock`. Normal analysis does
not acquire content. CI should use the committed lock and never run `add`.
