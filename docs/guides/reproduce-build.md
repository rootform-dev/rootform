---
title: "Reproduce a build offline"
description: "Prepare exact Dialects, preserve the lock, and rebuild from vendored content without a registry."
---

Prepare a project once, then prove that the same source builds with the same
semantic inputs without network access. Use the
[first architecture](../getting-started/first-architecture.md) or a supported
Terraform/OpenTofu root. Remote modules must already be materialized.

## Establish the selection

From the project root, while registry access is available:

```sh
rootform init . --no-input
rootform list dialects
```

Initialization writes or verifies `rootform.lock`. Review the selected names,
versions, origins, and any unsupported-provider warning. Commit the lock with
source when the selection is correct.

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

For unchanged source and selection, the comparison prints `no architectural
change` and exits `0`. The architecture files are byte-identical. If exact
packages are missing, Rootform reports the missing selection and fails; it does
not choose another version.

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

## Update deliberately

To select newer compatible Dialects while online:

```sh
rootform init . --upgrade --no-input
```

Review the lock diff and rebuild the architecture. If you vendor packages,
refresh that material from the new lock as well. A changed Dialect selection can
change interpretation; old and new architecture files may then be incomparable.
Do not attribute that mismatch to Terraform changes.

For an additional package source, `rootform init --source` accepts a tagged or
digest-pinned OCI Dialect artifact or index. It extends the configured sources
without giving one source priority. `--locked` cannot be combined with source,
pack-selection, or upgrade requests because those requests can change selection.
See [initialization reference](../reference/cli/init.md) for exact flags.
