---
title: "Reproduce a build offline"
description: "Pin Rootform, preserve exact project selection, and rebuild without registry access."
---

Reproduction fixes Rootform binary, project source, and any explicit external
selection. Supplied RF Vocabulary and Dialects are already in binary.

## Record common inputs

```sh
rootform version
rootform list dialects
```

Record source revision and exact Rootform version with review evidence. The
binary fixes supplied release set; source fixes declarations and references.

## Reproduce a supplied-only build

A project using only supplied content needs no lock or preparation:

<!-- docs-check:baseline -->
```sh
rootform build . --output before.json
```

Normal build performs no network access. Repeat with same binary and source:

<!-- docs-check:offline -->
```sh
rootform build . --output after.json
rootform diff before.json after.json --exit-code
```

Expect `no architectural change` and status `0`. Compare exact bytes when
reproduction requires canonical identity:

```sh
cmp -s before.json after.json
```

## Prepare an external selection

If project uses third-party Dialects, exclusions or replacements, or Policy
Packs, author exact format-1 `rootform.lock`. Validate local entries and acquire
missing exact OCI pins while connected:

```sh
rootform init . --locked --no-input
rootform build . --locked --output before.json
```

`init` preserves lock bytes and never discovers or resolves selection. Keep
binary, source, and lock unchanged for replay.

## Carry selected packages with project

Vendor each non-embedded family selected by lock:

<!-- docs-check:vendor -->
```sh
rootform vendor dialects --offline
rootform vendor policy-packs --offline
```

Commands materialize exact selected entries under `.rootform/dialects` and
`.rootform/policy-packs`. Supplied Dialects and RF Vocabulary are never
vendored. A present vendor family is exclusive execution source.

Prove independence from shared home:

<!-- docs-check:empty-home -->
```sh
ROOTFORM_HOME="$PWD/empty-rootform-home" \
  rootform build . --locked --output vendored.json
rootform diff before.json vendored.json --exit-code
```

Damaged or incomplete vendor content fails closed. Repair explicitly with
online `rootform vendor dialects` or `rootform vendor policy-packs`; neither
changes selection.

Keep selection changes outside reproduction proof. See
[locks and offline use](../offline-security.md),
[external content](external-content.md), and
[project preparation](../cli.md).
