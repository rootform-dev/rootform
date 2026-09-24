---
title: "Where Rootform stores external content"
description: "Exact locations, owners, and guarantees for the Rootform home, rootform.lock, and the .rootform vendor directory."
---

Rootform keeps external Dialects and Policy Packs in three places. Your
Rootform home belongs to you and is shared by every project on the machine.
`rootform.lock` and `.rootform/` belong to one project and travel with it.
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
for example a cache directory on a CI runner.

| Path | Contents |
| --- | --- |
| `dialects/<owner>/<version>/` | installed OCI Dialects |
| `policy-packs/<name>/<version>/` | installed OCI Policy Packs |
| `cache/` | derived content that Rootform can recreate |
| `tmp/` | incomplete work; safe to delete when no Rootform command runs |

Installed versions are immutable and verified every time they are read. One
version of a Dialect or Policy Pack comes from one repository on a machine;
installing the same version from another repository stops and names the
installed one. Any number of versions can be installed side by side.
Installation never selects content for a project. `rootform list dialects
--installed` and `rootform list policy-packs --installed` report installed versions;
`rootform uninstall dialects <owner>@<version>` deletes one. A project that
still selects that OCI version can restore it through `rootform init` when
network access is allowed. A valid vendor tree needs no installed copy.

Deleting the Rootform home removes installed copies and derived content.
An unvendored OCI selection then needs `rootform init` and may require registry
access. An unvendored local-only project still reads and verifies its recorded
paths without the Rootform home.

## rootform.lock

`rootform.lock` sits at the project root and records the project's exact
selection: each external or replacing Dialect, each Policy Pack, and each
embedded owner the project excludes. A project that uses only embedded
Dialects needs no lock.

Rootform writes this file. `rootform add`, `rootform update`, and
`rootform remove` are its only writers; every other command only reads it.
Each write:

- happens only after every requested change resolved and verified;
- keeps unrelated entries exactly as they were;
- produces the same bytes for the same selection, with entries in a fixed
  order;
- replaces the file atomically: a failure or interruption before the
  replacement leaves the previous version, and once the new file is in
  place the change is complete;
- leaves the file untouched when nothing changes.

While a write is in progress, Rootform holds `rootform.lock.new` beside the
lock. `rootform vendor` holds the same file while it writes `.rootform/`. A
second `add`, `update`, `remove`, or `vendor` in the same project stops at
once, names that file, and changes nothing; run it again when the first
finishes. If a command was killed, the file stays behind and every later write
stops the same way; delete it when no Rootform command is running. Rootform
also re-reads `rootform.lock` just before replacing it and stops if the file
changed, for example because an editor saved it. A save in
the instant between that check and the replacement is not detected, so avoid
editing the lock while a Rootform write runs.

Commit `rootform.lock` and review its diff like any dependency change. You do
not need to edit it. A hand edit that keeps the file valid is accepted; an
invalid file makes every command stop with the reason, and Rootform never
rewrites it. After a merge conflict, keep the entries you want and run
`rootform init` to verify the result.

Local selections record a path relative to the project root and the digest of
the compiled content. A path outside the project, such as `../shared`, needs
that sibling checkout on every machine unless the project is vendored. When
that content changes, commands stop until you run
`rootform update dialect <owner>` or `rootform update policy-pack <name>`
to record the new content. OCI selections record the repository and exact
digests. A tag is never recorded.

## .rootform

`rootform vendor` writes the selected content under the project:

| Path | Contents |
| --- | --- |
| `.rootform/dialects/<owner>/` | one selected Dialect |
| `.rootform/policy-packs/<name>/` | one selected Policy Pack |

When `.rootform/dialects/` exists, Rootform reads selected Dialects only from
it, and it must contain exactly the selected Dialects with their recorded
content. The same rule applies to `.rootform/policy-packs/`. A missing,
extra, or changed entry stops the command; Rootform never falls back to your
Rootform home, a local path, or a registry. `rootform vendor` restores the
directory from the lock. While `.rootform/` exists, `add`, `update`, and
`remove` update it together with `rootform.lock`.

Removing the last selection of a family also removes its directory, and Git
does not keep empty directories. A later `add` to that family is not vendored;
its output names the command to run, such as `rootform vendor policy-packs`.

To stop vendoring, delete `.rootform/` and run `rootform init`.

## What each command guarantees

| Command or flag | Reads | May download | Writes |
| --- | --- | --- | --- |
| `build`, `check`, `run`, `diff`, `list`, `show`, `explain` | lock, vendor or local paths or installed copies | never | requested outputs and `$ROOTFORM_HOME/cache` only |
| `init` | lock, vendor or local paths or installed copies | missing OCI selections, by recorded digest | `$ROOTFORM_HOME` only when fetching missing OCI content; no write for local or vendored selections |
| `vendor` | lock, local paths or installed copies | missing OCI selections, by recorded digest | `.rootform/`; `$ROOTFORM_HOME` only when fetching missing OCI content |
| `add`, `update` | lock, operands | operands given as OCI references | `rootform.lock`, `.rootform/` when present; `$ROOTFORM_HOME` only for OCI operands |
| `remove` | lock | never | `rootform.lock`, `.rootform/` when present |
| `install` | operands | operands given as OCI references | `$ROOTFORM_HOME` |
| `uninstall` | `$ROOTFORM_HOME` | never | `$ROOTFORM_HOME` |
| `--offline` or `ROOTFORM_OFFLINE=1` | as above | never | as above |
| `--locked` | requires `rootform.lock` to exist | as above | never `rootform.lock`; rejects `--dialect` and `--policy-pack` |

`init --locked --offline` therefore proves, without network access, that
every selected unit is present with its recorded content. In a vendored
project, `init` checks the vendored copies and needs neither the Rootform
home nor a registry. `add`, `update`, and `remove` do not accept `--locked`.
With `--offline`, `add` and `update`
accept local directories and digest references that are already installed;
a tag cannot be resolved offline.
