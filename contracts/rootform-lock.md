# `rootform.lock` contract

Current format version: `1`.

`rootform.lock` is deterministic JSON pinning exact Rootform dialect semantic,
presentation, optional acquisition identities, and explicit official
non-coverage. It is authoritative for Rootform dialects only. Terraform and
OpenTofu provider versions remain owned by source code and
`.terraform.lock.hcl`; they never enter this file.

## Top-level fields

- `format_version`: exact string `1`;
- `index`: optional acquisition provenance containing OCI `repository` and
  exact `manifest_digest`;
- `unsupported_providers`: required, sorted, unique array of canonical provider
  sources such as `registry.terraform.io/hashicorp/aws`;
- `entries`: required array ordered by dialect name then version.

At least one dialect entry or one unsupported provider is required. Empty
`entries` is meaningful only when official metadata proved every observed
provider has no selected official dialect. `unsupported_providers` records no
provider version, constraint, local name, alias, declaration, or behavior.

Each dialect entry contains:

- lowercase dialect `name`;
- exact `x.y.z` `version`;
- semantic `digest`;
- optional `presentation_digest`;
- optional `artifact` acquisition pin.

Artifact pin contains exact OCI `repository`, `manifest_digest`, `layer_digest`,
positive `download_size`, and positive `install_size`. Digests use lowercase
`sha256:<64 hexadecimal characters>`. Local authoring locks may omit index and
artifact pins. Lock used to reacquire missing remote content must contain
complete artifact pins for that content.

For locked acquisition, `artifact.repository` is tagless OCI repository
location and `manifest_digest` is exact artifact identity. Each entry may name
different standards-compatible public or private repository. Client resolves
manifest by digest from that entry's repository; official repository and
top-level `index` pin have no special role on this path. Registry identity never
replaces descriptor, archive, semantic, presentation, dependency, or provider
verification.

## Validation and identity

- one entry per dialect name;
- entries and unsupported providers use strict canonical order;
- provider sources are fully qualified canonical identities;
- unknown fields, duplicate JSON keys, trailing values, invalid names,
  versions, sources, digests, sizes, and noncanonical order are rejected;
- whitespace and object-field order are insignificant;
- semantic and presentation digests verify independently;
- acquisition metadata never changes semantic or presentation identity;
- extra Terraform/OpenTofu provider lock entries never create Rootform dialect
  or unsupported-provider evidence;
- missing, extra, changed, or differently versioned dialects make selection
  incoherent and refuse `--locked` execution;
- same-version artifact content with another digest is never substituted.

Current shape is format 1. Normal init may normalize a valid earlier minimal
format-1 lock while recomputing current evidence.
`rootform init --locked` never normalizes, creates, or modifies lock. Unknown
formats, malformed input, and current code incompatible with locked selection
fail before acquisition and are never overwritten.

## Preparation and mutation

Directory `build`, `check`, `run`, and explicit `init` use same preparation
service. Coherent and locally complete locked project performs no network access
or write. Missing exact pinned artifact may be recovered from its own repository
without consulting index and without changing lock bytes.
With no lock, interactive confirmation or unique no-input recommendations may
create one and original command resumes.

Interactive normal command may update existing lock only after showing complete
proposal and receiving confirmation. Normal no-input command never changes
existing lock; explicit `rootform init [path] --no-input` grants that authority.
`--locked` requires existing lock and permits no change. `--offline` permits no
network. Combined flags freeze selection and acquisition input.

Canonical project markers are `rootform.lock` and `.rootform/dialects/` directly
beneath selected project root. No parent search occurs. Present vendored
directory is exclusive dialect source; store never supplies fallback. Vendor
and lock evolution commit transactionally.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
