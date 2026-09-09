---
title: "Reproduce a build offline"
description: "Prepare exact Dialects, preserve the lock, and rebuild from vendored content without a registry."
---

Prepare a project once, then prove that the same source builds with the same
Rootform version and exact Dialects without network access. Use the
[first architecture](../getting-started/first-architecture.md) or a supported
Terraform/OpenTofu root. Remote modules must already be materialized.

## Establish the selection

Use the same Rootform version for the baseline and every repeat. The lock pins
Dialect selection, not the executable. Record the version, then prepare from
the project root while registry access is available:

```sh
rootform version
rootform init . --no-input
rootform list dialects
```

Initialization writes or verifies `rootform.lock`. Review the selected names,
versions, origins, and any unsupported-provider warning. Commit the lock with
the source when the selection is correct.

Save a baseline using that lock:

<!-- docs-check:baseline -->
```sh
rootform build . --locked --no-input --output before.json
```

`--locked` preserves the lock but can recover exact missing packages. The
[lock explanation](../offline-security.md) distinguishes that from offline use.

## Rebuild without downloads

<!-- docs-check:offline -->
```sh
rootform build . --locked --offline --no-input --output after.json
rootform diff before.json after.json --exit-code
```

For unchanged source, Rootform version, and selection, the comparison prints
`no architectural change` and exits `0`. Verify canonical bytes too on macOS or
Linux:

```sh
cmp -s before.json after.json
```

Status `0` confirms byte identity. If exact packages are missing, Rootform
reports the missing selection and fails; it does not choose another version.

## Carry packages with the project

<!-- docs-check:vendor -->
```sh
rootform vendor dialects --offline
```

This writes `.rootform/dialects/` from the already available locked content.
If the project selects Policy Packs, vendor those separately:

```sh
rootform vendor policy-packs --offline
```

Review the vendor tree together with the lock. Its presence makes it the
exclusive source for that package family. To prove that the project does not
rely on the installed store, use a new empty home. On macOS/Linux:

<!-- docs-check:empty-home -->
```sh
ROOTFORM_HOME="$PWD/empty-rootform-home" \
  rootform build . --locked --offline --no-input --output vendored.json
rootform diff before.json vendored.json --exit-code
```

Use a directory that does not already contain Rootform packages. Expect the
same no-change result. In PowerShell, set `$env:ROOTFORM_HOME` to the chosen
empty directory before the build and restore its previous value afterward.

If vendor content is missing or damaged, explicitly repair it with
`rootform vendor dialects` or `rootform vendor policy-packs`. Omit `--offline`
only when exact registry recovery is permitted. Do not remove a damaged vendor
directory to hide the failure behind a different execution source.

## Change selection separately

Dialect upgrades and added package sources can change interpretation, so keep
them outside reproduction proof. Follow [project preparation](../cli.md) for a
reviewed selection change, refresh vendor material, then establish a new baseline.
