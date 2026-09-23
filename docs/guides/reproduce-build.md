---
title: "Reproduce a build offline"
description: "Transfer exact Rootform inputs and reproduce architecture in an independent environment."
---

An offline reproduction preserves the exact Rootform binary, a compatible
platform, project source, resolved modules, and every external selection used
by the command. Git carries committed files only. It does not materialize
remote modules or OCI content.

Remote modules must already exist beneath `.terraform/modules` and match
`.terraform/modules/modules.json`. Transfer both the module directories and
that manifest with the project. See [Make modules available locally](../inputs/index.md#make-modules-available-locally).

## Reproduce a project with embedded Dialects only

A supplied-only project has no `rootform.lock` and needs no preparation. On the
source environment, record the binary identity and build the reference file:

<!-- docs-check:offline-embedded-source -->
```sh
rootform version
rootform build /path/to/source-project --output /path/to/evidence/before.json
```

Transfer the exact Rootform executable for the target platform, project source,
resolved modules, and `before.json` into an independent location.

On the replay environment, create a genuinely new Rootform home and build the
independent copy:

<!-- docs-check:offline-embedded-replay -->
```sh
replay_home=$(mktemp -d "${TMPDIR:-/tmp}/rootform-home.XXXXXX")
ROOTFORM_HOME="$replay_home" \
  rootform build /path/to/replay-project --output /path/to/evidence/after.json
rootform diff /path/to/evidence/before.json \
  /path/to/evidence/after.json --exit-code
cmp -s /path/to/evidence/before.json /path/to/evidence/after.json
```

Expected Diff output:

```text
Architecture unchanged
```

Status `0` from `diff --exit-code` proves no determined or undetermined
architecture change. Status `0` from `cmp -s` separately proves byte identity.
Neither result substitutes for the other.

A fresh `ROOTFORM_HOME` proves the replay did not use shared Rootform content.
It does not by itself prove network isolation. Run this stage in the intended
offline or network-disabled environment for that proof. Normal `build` does not
acquire content.

## Prepare an external selection with --no-input

Start from a project with reviewed `rootform.lock`. On the connected source
environment, prepare exact OCI pins and verify local entries:

```sh
cd /path/to/source-project
rootform init . --locked --no-input
```

Vendor only families the replay needs. A selected external Dialect is required
for architecture construction:

<!-- docs-check:offline-vendor-dialects -->
```sh
cd /path/to/source-project
rootform vendor dialects --offline
```

Vendor Policy Packs when reproducing `check`:

<!-- docs-check:offline-vendor-policy-packs -->
```sh
cd /path/to/source-project
rootform vendor policy-packs --offline
```

Both commands act on `/path/to/source-project/rootform.lock` because they run
from that project root. Embedded Dialects and RF Vocabulary are not copied.

Build the reference after vendoring, so source and replay use the same
project-local execution boundary:

<!-- docs-check:offline-external-source -->
```sh
cd /path/to/source-project
rootform build . --locked --output /path/to/evidence/before.json
```

Transfer these items:

- exact Rootform executable for a compatible platform
- project source and required local or materialized modules
- unchanged `rootform.lock`
- `.rootform/dialects` when external Dialects are selected
- `.rootform/policy-packs` when a Policy check must be reproduced
- `before.json` for comparison

Copy them into an independent project location. Copying only `rootform.lock`
does not transport selected content.

On the replay environment, use another new home:

<!-- docs-check:offline-external-replay -->
```sh
cd /path/to/replay-project
replay_home=$(mktemp -d "${TMPDIR:-/tmp}/rootform-home.XXXXXX")
ROOTFORM_HOME="$replay_home" \
  rootform build . --locked --output /path/to/evidence/after.json
rootform diff /path/to/evidence/before.json \
  /path/to/evidence/after.json --exit-code
cmp -s /path/to/evidence/before.json /path/to/evidence/after.json
```

To reproduce governance with the transferred Policy Pack vendor, run:

```sh
rootform check . --locked
```

Compare its structured output and exit status separately from Architecture IR.

## Detect and repair an incomplete vendor

If a selected file is missing or altered beneath `.rootform/dialects` or
`.rootform/policy-packs`, normal execution fails with status `3`. It does not
fall back to a local source, shared home, cache, or registry.

Repair the same selection explicitly. When verified bytes are available in the
replay environment, run the matching vendor command from that project root
with `--offline`. Otherwise rerun `init` and `vendor` in the connected source
environment, then transfer the complete verified vendor family again. Keep
`rootform.lock` unchanged. Do not delete it to bypass an integrity failure.

[Locks and vendored content](../offline-security.md) explains source precedence
and command controls. [Use external Dialects and Policy Packs](external-content.md)
shows how to create the selection before transfer.
