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

## Choose source, replay, and report paths

Replace these placeholders throughout the commands:

- `/path/to/source-project` is the prepared project on the source environment
- `/path/to/replay-project` is its independent copy on the replay environment
- `/path/to/evidence` is the directory that carries comparison reports

Create the report directory before the first build:

<!-- docs-check:offline-evidence-directory -->
```sh
mkdir -p /path/to/evidence
```

## Reproduce a project with embedded Dialects only

A project using only embedded Dialects has no `rootform.lock` and needs no
preparation. On the source environment, record the binary identity and build the
reference file:

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

On the connected source environment, select reviewed local content from
project-relative directories, then prepare the exact lock. This example
assumes `./dialects/payments` is a valid Dialect source. For OCI content, use
its reviewed registry reference with `add` instead:

<!-- docs-check:offline-add-dialect -->
```sh
cd /path/to/source-project
rootform add dialects ./dialects/payments
rootform init . --locked --no-input
```

Commit `rootform.lock` with the selected source. `init` never changes it.

Vendor only families the replay needs. A selected external Dialect is required
for architecture construction:

<!-- docs-check:offline-vendor-dialects -->
```sh
cd /path/to/source-project
rootform vendor dialects --offline
```

The command acts on `/path/to/source-project/rootform.lock` because it runs
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
- `before.json` for comparison

Copy them into an independent project location. Copying only `rootform.lock`
does not transport selected content. After vendoring, the project vendor copy is
sufficient on replay, even if the original `dialects/payments` source directory
stays on the source machine.

On the replay environment, use another new home:

<!-- docs-check:offline-external-replay -->
```sh
cd /path/to/replay-project
replay_home=$(mktemp -d "${TMPDIR:-/tmp}/rootform-home.XXXXXX")
ROOTFORM_HOME="$replay_home" \
  rootform init . --locked --offline --no-input
ROOTFORM_HOME="$replay_home" \
  rootform build . --locked --output /path/to/evidence/after.json
rootform diff /path/to/evidence/before.json \
  /path/to/evidence/after.json --exit-code
cmp -s /path/to/evidence/before.json /path/to/evidence/after.json
```

This build-only path needs no Policy Pack vendor, Policy evaluation, or check
report.

### Add governance evidence when needed

Governance reproduction is optional. Use the `tutorial` Policy Pack from
[Run checks](check-architecture.md), whose target matches the example subnet.
On the source environment, select and vendor it, then save its result and
status:

<!-- docs-check:offline-vendor-policy-packs -->
```sh
cd /path/to/source-project
rootform add policy-packs ./policies
rootform init . --locked --no-input
rootform vendor policy-packs --offline
```

<!-- docs-check:offline-governance-source -->
```sh
cd /path/to/source-project
if rootform check . --locked --format json \
  --output /path/to/evidence/before-check.json
then
  source_check_status=0
else
  source_check_status=$?
fi
printf '%s\n' "$source_check_status" > /path/to/evidence/before-check.status
```

For this compliant example, `before-check.status` contains `0` and the JSON
report records one evaluated, passed Policy. Transfer `.rootform/policy-packs`,
`before-check.json`, and `before-check.status` with the build inputs. The
original `policies` source directory can remain on the source environment.

On the replay environment, create another new home and compare Policy evidence:

<!-- docs-check:offline-governance-replay -->
```sh
cd /path/to/replay-project
governance_home=$(mktemp -d "${TMPDIR:-/tmp}/rootform-home.XXXXXX")
if ROOTFORM_HOME="$governance_home" \
  rootform check . --locked --format json \
  --output /path/to/evidence/after-check.json
then
  replay_check_status=0
else
  replay_check_status=$?
fi
printf '%s\n' "$replay_check_status" > /path/to/evidence/after-check.status
cmp -s /path/to/evidence/before-check.json \
  /path/to/evidence/after-check.json
cmp -s /path/to/evidence/before-check.status \
  /path/to/evidence/after-check.status
```

Matching Policy JSON proves evaluation result was reproduced. Matching status
files proves command outcome was reproduced. Both remain separate from
Architecture Diff, byte identity, home independence, and network isolation.

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
and command controls. [Where Rootform stores external
content](../reference/storage.md) defines vendor ownership and repair. [Add
external content](external-content.md) shows how to create the
selection before transfer.
