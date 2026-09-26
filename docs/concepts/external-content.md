---
title: "Install, add, and vendor"
description: "How Rootform separates content available on a machine from the exact dependencies of a project."
---

Rootform separates content available on a machine from content selected by a
project. Installing a Dialect or Policy Pack never makes a project use it.
The project uses its exact selection, regardless of other installed content.

## Four states

A unit can be in more than one state:

| State | Where it lives | What puts it there |
| --- | --- | --- |
| **Embedded** | inside the `rootform` binary | ships with Rootform |
| **Installed** | verified OCI content in `$ROOTFORM_HOME` | `rootform install`; `add` or `update` with an OCI reference; `init` or `vendor` when a missing OCI selection is fetched |
| **Selected** | the project's `rootform.lock` | `rootform add` or `update`; `remove` drops a selection |
| **Vendored** | the project's `.rootform/` directory | `rootform vendor`; `add` or `update` when a vendor tree exists |

Embedded Dialects work without setup. Select external content only when the
project needs it. An explicit `--dialect` or `--policy-pack` override applies
to one command and does not change the project selection.

Installed content is available to projects, but never selected automatically.
The lock records a dependency's exact identity and source. Vendoring carries
the selected content with the project.

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

This assumes a valid Dialect source at that path. `add` records its
project-relative path and compiled content identity in `rootform.lock`.
Commit the lock with the source. The local source is not installed in your
Rootform home.

For OCI content, `add` resolves and verifies a tag or digest reference,
installs the unit, and records its exact identity. A later tag change cannot
change the selection. Multiple operands form one change; a failure leaves
the lock unchanged.

`update` records a changed version or source; `remove` drops a selection.
[Add external content](../guides/external-content.md) shows those tasks.

## Install prepares a machine

`rootform install` downloads and verifies OCI content into your Rootform home
without reading or changing any project:

<!-- docs-check:external-content-2 -->
```sh
rootform install dialects \
  registry.example.com/acme/rootform/payments:dialect-payments-0.1.0
```

The registry address is illustrative. Replace it with a published Dialect
reference; successful installation prints the verified owner and version.

Use `install` to prepare a machine before project selection, including one
that will later work offline. `add` already installs an OCI operand, so it
needs no prior `install`. Several versions can coexist on a machine; the
project uses only its selected version.

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

`init` preserves `rootform.lock`. It can fetch a missing OCI selection only
by its recorded identity; `--offline` prevents acquisition. Without vendored
content, it verifies local selections at their recorded paths. Once prepared,
the project can use its exact selection on that machine.

## Vendor keeps the bytes in the repository

`rootform vendor` copies selected external content into `.rootform/`, so a
clone can carry its dependencies. For each vendored family, Rootform reads
only that project copy and rejects missing, extra, or changed content. It
does not fall back to an installed copy. Selection changes keep an existing
vendor family in step with the lock.

Vendoring is optional. Use it when analyses need no prepared Rootform home or
when dependency content belongs in the project review. `vendor` can acquire
missing selected OCI content unless `--offline` is set.

`rootform init --locked --offline` verifies an existing vendor tree against
the lock. Missing, extra, or changed vendored content fails preparation.

## Which content a command uses

Rootform determines the active Dialects in this order:

1. Start from the embedded Dialects.
2. Drop the embedded owners that the project excludes.
3. Add selected Dialects from their vendored copy, recorded local path, or
   installed OCI copy, according to the selection's source.
4. Apply `--dialect` overrides given to this command.

For Policy Packs, `--policy-pack` overlays one pack by name for one command;
other selected packs remain active. An override never changes the lock. Two
overrides with the same owner or pack name fail. `--locked` rejects overrides.

A missing or different copy stops the command. Rootform never substitutes
another source or version, and normal analysis never acquires content. Policy
Packs have no embedded starting set.

## Embedded Dialects change only by project decision

Installing a Dialect with an embedded owner's name, such as `aws`, changes
nothing. Replacing the embedded Dialect requires a project decision:

<!-- docs-check:external-content-4 -->
```sh
rootform add dialects ./dialects/aws --replace
```

`rootform remove dialects aws` later drops the replacement and makes the
embedded `aws` active again. To stop using an embedded Dialect altogether,
run `rootform remove dialects aws --embedded`; `rootform add dialects aws`
brings it back.

## Policy Packs are the unit you select

Policies are selected and vendored as part of their Policy Pack. An OCI Pack
can also be installed; a local Pack stays at its recorded path. To evaluate
part of a selected Pack, filter one run with `--policy`:

<!-- docs-check:external-content-5 -->
```sh
rootform run plan.json --plan-file plan.tfplan --policy 'baseline/*' --no-serve
```

This assumes the project selects a `baseline` Policy Pack and that the saved
plan matches the JSON. The filter does not change `rootform.lock`; it still
selects the whole Pack. The result counts only policies matching `baseline/*`.
Status `0` means every selected target passed, `1` reports a violation, and
`3` means the evidence is indeterminate or no decision was made.

## Next

- [Use a local Dialect while authoring](../guides/local-dialect.md)
- [Add external content](../guides/external-content.md)
- [External content storage](../reference/storage.md)
