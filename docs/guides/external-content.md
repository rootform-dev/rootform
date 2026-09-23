---
title: "Use external Dialects and Policy Packs"
description: "Adopt reviewed local or OCI content through one exact project selection."
---

Use this guide after choosing an existing Dialect or Policy Pack. Local source
stays at a project-relative path. OCI content arrives with a complete identity
from its publisher. Both forms enter the same `rootform.lock` contract.

The [`rootform.lock` schema](../../schemas/rootform-lock.schema.json) requires
all four arrays, including empty ones. Rootform never creates or updates this
file.

## Select a local Policy Pack

Start from the `rootform-first-architecture` project created in
[Your first architecture](../getting-started/first-architecture.md#create-input).
Copy the two source files from
[Create the Policy Pack](check-architecture.md#create-the-policy-pack) into
`policies/pack.rf.hcl` and `policies/subnet-network-context.rf.hcl` inside that
project. Run every command in this section from `rootform-first-architecture`.

Inspect the local pack without a lock:

<!-- docs-check:external-local-policy-identity -->
```sh
rootform list policy-packs --policy-pack ./policies -o json
```

```json title="Local Policy Pack identity"
[
  {
    "name": "tutorial",
    "version": "0.1.0",
    "policies": 1,
    "content_digest": "sha256:3f301eea6cfe95b1c66ba3c768d3d57613c847ca245cdb5ad3838e6604a19e9e"
  }
]
```

`content_digest` identifies compiled Policy Pack content. It is not a source
file checksum, an OCI manifest digest, or an OCI layer digest.

Record the reported name, version, and digest with the project-relative source
path:

```json title="rootform.lock (local Policy Pack)"
{
  "format_version": "1",
  "dialects": [],
  "policy_packs": [
    {
      "name": "tutorial",
      "version": "0.1.0",
      "content_digest": "sha256:3f301eea6cfe95b1c66ba3c768d3d57613c847ca245cdb5ad3838e6604a19e9e",
      "source": {
        "local": {
          "path": "policies"
        }
      }
    }
  ],
  "excluded_owners": [],
  "replacements": []
}
```

Prepare and inspect the exact project selection:

<!-- docs-check:external-local-policy-init -->
```sh
rootform init . --locked --offline --no-input
rootform list policy-packs -o json
rootform list policies -o wide
```

Evaluate the selected pack:

<!-- docs-check:external-local-policy-check -->
```sh
rootform check . --locked
```

```text title="Locked Policy check"
Policies compliant

Policies     1 selected
Evaluations  1
Results      1 passed
```

Preparation proves identity and availability. The check separately proves that
the selected Policy evaluated `aws_subnet.application` and passed.

## Obtain a local Dialect identity

The Dialect provider should supply owner, version, and `content_digest` with
the reviewed source. `rootform list dialects` inspects embedded or already
selected Dialects, so it cannot bootstrap an unselected source directory.

When only reviewed source is available, create a local OCI layout to expose its
compiled identity. This example uses the
[Confluent Dialect source](https://github.com/rootform-dev/rootform/tree/dev/dialects/confluent).
Download or copy that complete directory to `third-party/confluent` inside
`rootform-first-architecture`. Run the following block from the project root.
`jq` is required only for this advanced identity extraction. Packaging stays
local and publishes nothing. `mktemp` creates a temporary parent directory,
while Rootform creates the previously absent `layout` destination:

<!-- docs-check:external-local-dialect-identity -->
```sh
identity_workspace=$(mktemp -d "${TMPDIR:-/tmp}/rootform-identity.XXXXXX")
identity_dir="$identity_workspace/layout"
rootform package dialects ./third-party/confluent --to "$identity_dir" >/dev/null
manifest_digest=$(jq -r '.manifests[0].digest' "$identity_dir/index.json")
manifest_file="$identity_dir/blobs/sha256/${manifest_digest#sha256:}"
config_digest=$(jq -r '.config.digest' "$manifest_file")
config_file="$identity_dir/blobs/sha256/${config_digest#sha256:}"
jq '{owner, version, content_digest}' "$config_file"
```

```json title="Extracted Dialect identity"
{
  "owner": "confluent",
  "version": "0.1.0",
  "content_digest": "sha256:57bc8a2038fc1159adf19486a7f8875ab8ca8c4d9af72865e502f36b8104470e"
}
```

This reads Rootform's generated config artifact. It does not calculate a
replacement digest. The `Digest` printed by `package dialects` is the OCI
manifest digest, not `content_digest`. Keep these identities separate when
writing the `dialects` entry.

Record a complete local selection:

```json title="rootform.lock (local Dialect)"
{
  "format_version": "1",
  "dialects": [
    {
      "owner": "confluent",
      "version": "0.1.0",
      "content_digest": "sha256:57bc8a2038fc1159adf19486a7f8875ab8ca8c4d9af72865e502f36b8104470e",
      "source": {
        "local": {
          "path": "third-party/confluent"
        }
      }
    }
  ],
  "policy_packs": [],
  "excluded_owners": [],
  "replacements": ["confluent"]
}
```

The example owner `confluent` is already embedded in Rootform. The
`replacements` entry explicitly authorizes the local Dialect to replace that
embedded owner. This authorization is specific to the collision demonstrated
here. A local Dialect with a new owner does not need a replacement entry.

Prepare the local selection without changing the lock, then inspect its origin:

<!-- docs-check:external-local-dialect-init -->
```sh
rootform init . --locked --offline --no-input
rootform list dialects --dialect confluent -o wide
```

```text title="Selected local Dialect"
Project prepared

External dialects      1
External Policy Packs  0
NAME       VERSION  ORIGIN  CONCEPTS  CONTEXTS  RELATIONS  RULES
confluent  0.1.0    local         37         1         19     62
```

## Select published OCI content

Start from one publisher-provided record for each artifact:

- owner or pack name and version
- `content_digest`
- tagless repository
- manifest and layer digests
- download and install sizes

Do not combine values from different package builds. A mutable tag is not part
of execution identity.

The following template is schema-valid but intentionally not runnable because
`registry.example` is a documentation domain. Replace every repository and
descriptor field with one complete identity supplied for the content you
reviewed:

```json title="rootform.lock (OCI template)"
{
  "format_version": "1",
  "dialects": [
    {
      "owner": "confluent",
      "version": "0.1.0",
      "content_digest": "sha256:57bc8a2038fc1159adf19486a7f8875ab8ca8c4d9af72865e502f36b8104470e",
      "source": {
        "oci": {
          "repository": "registry.example/team/dialects/confluent",
          "manifest_digest": "sha256:22648a24e57c0d3afd0f636b50feb3e9374e87efbc2becf1364312cfb038e7e9",
          "layer_digest": "sha256:010ae47d7d59a7948c14e1319127bda284a6fa9051628d2258cfd7dcddb349b7",
          "download_size": 4989,
          "install_size": 31570
        }
      }
    }
  ],
  "policy_packs": [
    {
      "name": "baseline",
      "version": "0.1.0",
      "content_digest": "sha256:252d152ab845848c50f1ecccee7da5b6ee8e0cedeac34e0cd7f820de5246aa47",
      "source": {
        "oci": {
          "repository": "registry.example/team/policy-packs/baseline",
          "manifest_digest": "sha256:1817ae3b3c9bffee6234f886e6484ed9a0cfab9a745aa1f3417027184f07fe5f",
          "layer_digest": "sha256:138c55e2d1573a09fed8496dc660ed7cdb15cc1b6da0a40bdf1b1a34faa5f9a5",
          "download_size": 4731,
          "install_size": 12542
        }
      }
    }
  ],
  "excluded_owners": [],
  "replacements": ["confluent"]
}
```

Here `replacements` authorizes the selected `confluent` Dialect to replace the
embedded owner with the same name. After substituting the real publisher
identity, prepare only those exact pins:

```sh
rootform init . --locked --no-input
rootform list dialects -o wide
rootform list policy-packs -o wide
```

`init` can acquire missing OCI bytes from the recorded repositories when
network access is allowed. It does not resolve a version, inspect tags, list a
registry, or rewrite the lock.

## Exclude or replace an owner

Add an embedded owner to `excluded_owners` to remove its Dialect from the
effective catalog. Add the owner to `replacements` only when `dialects` also
selects another Dialect with that owner. A collision without replacement is an
error. Reserved owner `rf` is protected and cannot appear in either array.

Review [Locks and vendored content](../offline-security.md) for preparation and
source precedence. Use [Reproduce a build offline](reproduce-build.md) to
transport a verified selection. To distribute content you author, continue with
the [`package`](../reference/cli/package.md) and
[`publish`](../reference/cli/publish.md) references.
