---
title: "Use external Dialects and Policy Packs"
description: "Select exact local or OCI content without changing Rootform's embedded release set."
---

Rootform includes RF Vocabulary and supplied Dialects in its binary. Add a
`rootform.lock` only when a project needs a third-party Dialect, a Policy Pack,
a supplied-owner exclusion, or an explicit Dialect replacement.

Rootform never discovers these selections from providers or a registry. The
lock must already contain their exact identities.

## Choose local source or OCI content

Each `dialects` entry names an owner, version, content digest, and one source.
Each `policy_packs` entry uses the same shape with a pack name.

| Source | Use it when | Required identity |
| --- | --- | --- |
| `local` | Source lives inside or beside the project. | Relative path plus exact compiled content digest. |
| `oci` | Reviewed content is distributed through an OCI registry. | Tagless repository, manifest and layer digests, download and install sizes, version, and content digest. |

The complete format is defined by the
[`rootform.lock` schema](../../schemas/rootform-lock.schema.json). All four
top-level arrays are required, including when empty:

```json title="rootform.lock (local-source template)"
{
  "format_version": "1",
  "dialects": [
    {
      "owner": "example",
      "version": "0.1.0",
      "content_digest": "<digest reported for the reviewed Dialect>",
      "source": { "local": { "path": "third-party/example" } }
    }
  ],
  "policy_packs": [
    {
      "name": "baseline",
      "version": "0.1.0",
      "content_digest": "<digest reported for the reviewed Policy Pack>",
      "source": { "local": { "path": "policies/baseline" } }
    }
  ],
  "excluded_owners": [],
  "replacements": []
}
```

Replace bracketed values with exact values produced from reviewed content.
Paths are relative to project root. Rootform recompiles local source and refuses
a digest mismatch.

## Prepare an OCI selection

Package author creates deterministic local layout, then publishes it separately:

```sh
rootform package dialects ./example --to ./artifacts/dialects
rootform publish dialects ./artifacts/dialects --to registry.example/team/dialects
```

Policy Packs use `package policy-packs` and `publish policy-packs`. Publication
reports exact repository, manifest digest, layer digest, sizes, version, and
content digest. Record those values in lock. Do not record mutable tag.

Prepare existing selection explicitly:

```sh
rootform init . --locked --no-input
```

`init` verifies local entries and installed content. It may fetch only missing
OCI manifests already pinned in lock. It never creates or edits lock, resolves a
version, lists a registry, or changes supplied release set.

Installed third-party content lives under `$ROOTFORM_HOME/dialects` and
`$ROOTFORM_HOME/policy-packs`. Supplied Dialects and RF Vocabulary remain inside
binary.

## Use local Policy Pack while authoring

An explicit local pack can replace project Policy Pack selection for one check:

```sh
rootform check . --policy-pack ./policies
```

This does not add pack to lock or install it. Do not combine explicit
`--policy-pack` with `--locked`.

## Vendor exact selections

Vendor copies selected non-embedded content into project:

```sh
rootform vendor dialects
rootform vendor policy-packs
```

Default destinations are `.rootform/dialects` and
`.rootform/policy-packs`. Once present, each directory is exclusive source for
its kind. Missing or changed vendored content fails instead of falling back to
store or registry.

Use `--offline` only when every required byte already exists locally or in
verified cache. See [Reproduce a build offline](reproduce-build.md) for transfer
workflow.

## Exclude or replace one owner

`excluded_owners` removes supplied Dialect owner from effective catalog.
`replacements` authorizes selected Dialect with same owner to replace it.
Without explicit replacement, owner collision is error. Reserved owner `rf`
cannot be excluded or replaced.

Review [project preparation](../cli.md) for command behavior and
[security guidance](../security/index.md) before using private registry.
