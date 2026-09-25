---
title: "External content storage"
description: "Locations and ownership of installed, selected, and vendored Rootform content."
---

External content and its selection occupy three locations. Your Rootform
home is shared by projects on this machine. `rootform.lock` and `.rootform/`
belong to one project and travel with it.
[Install, add, and vendor](../concepts/external-content.md) explains how the
three relate.

| Location | Owner | Holds | Commit to version control |
| --- | --- | --- | --- |
| `$ROOTFORM_HOME` | you, on this machine | installed OCI content and derived cache | No |
| `rootform.lock` | the project | exact selection | Yes |
| `.rootform/` | the project | vendored copies of the selection | Yes, when you vendor |

Embedded Dialects and the RF Vocabulary live inside the `rootform` binary and
appear in none of these locations.

## Rootform home

`$ROOTFORM_HOME` defaults to `~/.rootform` (`%USERPROFILE%\.rootform` on
Windows). Set `ROOTFORM_HOME` to an absolute path to use another directory,
for example one preserved across CI jobs.

| Path | Contents |
| --- | --- |
| `dialects/<owner>/<version>/` | installed OCI Dialects |
| `policy-packs/<name>/<version>/` | installed OCI Policy Packs |
| `cache/` | derived content that Rootform can recreate |

Rootform verifies installed versions when it reads them. Several versions
can coexist. Installation does not select content for a project.
`rootform list dialects --installed` and
`rootform list policy-packs --installed` report installed versions;
`rootform uninstall dialects <owner>@<version>` deletes one. An unvendored
project that still selects the deleted version needs `rootform init` to
restore it. A valid vendor tree needs no installed copy.

Deleting the Rootform home removes installed copies and derived content.
An unvendored OCI selection then needs `rootform init` and may require registry
access. An unvendored local-only project still reads and verifies its recorded
paths without the Rootform home.

## rootform.lock

`rootform.lock` sits at the project root and records the project's exact
selection: each external or replacing Dialect, each Policy Pack, and each
embedded owner the project excludes. A project that uses only embedded
Dialects needs no lock.

`rootform add`, `rootform update`, and `rootform remove` write the lock.
Other commands preserve it. Commit the lock and review its diff like any
dependency change. After resolving a merge conflict, run `rootform init`
to verify the chosen entries. The [lock contract](../../contracts/rootform-lock.md)
defines its exact fields and write guarantees.

Local selections record a path relative to the project root and the identity
of compiled content. A path outside the project, such as `../shared`, needs
that sibling checkout on every machine unless the project is vendored. When
content changes, run `rootform update dialect <owner>` or
`rootform update policy-pack <name>` to record it. OCI selections record an
exact identity; a tag is never recorded.

## .rootform

`rootform vendor` writes the selected content under the project:

| Path | Contents |
| --- | --- |
| `.rootform/dialects/<owner>/` | one selected Dialect |
| `.rootform/policy-packs/<name>/` | one selected Policy Pack |

Each vendored family is the exclusive source for its selected content. A
missing, extra, or changed entry stops the command. `rootform vendor`
restores the family from the lock; `add`, `update`, and `remove` keep an
existing vendor family in step with selection changes.

Removing the last selection of a family also removes its directory, and Git
does not keep empty directories. A later `add` to that family is not vendored;
its output names the command to run, such as `rootform vendor policy-packs`.

To stop vendoring, delete `.rootform/` and run `rootform init` to verify the
remaining selected sources. See [Locks and vendored content](../offline-security.md)
for acquisition and offline controls, and
[Troubleshooting](../troubleshooting/index.md#vendored-content-is-incomplete-or-altered)
for repair after an integrity failure.

## What each command guarantees

| Command | Changes selection | Can acquire OCI content | Persistent location changed |
| --- | --- | --- | --- |
| `install` | No | Yes | `$ROOTFORM_HOME` |
| `uninstall` | No | No | `$ROOTFORM_HOME` |
| `add`, `update` | Yes | For OCI operands | `rootform.lock`, existing vendor family, and `$ROOTFORM_HOME` for OCI operands |
| `remove` | Yes | No | `rootform.lock` and existing vendor family |
| `init` | No | Missing selected OCI content | `$ROOTFORM_HOME` when it fetches |
| `vendor` | No | Missing selected OCI content | `.rootform/` and `$ROOTFORM_HOME` when it fetches |
| `build`, `check`, `run`, `diff`, `list`, `show`, `explain` | No | No | Requested output and derived cache, when applicable |

`--offline` disables acquisition for commands that accept it. `--locked`
requires an existing valid lock and does not disable exact acquisition by
`init`.
