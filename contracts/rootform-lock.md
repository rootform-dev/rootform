# `rootform.lock` contract

Current format version: `1`.

`rootform.lock` is deterministic JSON pinning exact Rootform dialect semantic,
presentation, optional acquisition identities, and explicit non-coverage. It
is authoritative for Rootform dialects only. Terraform and
OpenTofu provider versions remain owned by source code and
`.terraform.lock.hcl`; they never enter this file.

## Top-level fields

- `format_version`: exact string `1`;
- `index`: optional legacy singular index provenance containing OCI
  `repository` and exact `manifest_digest`;
- `sources`: optional canonical array of bounded OCI source provenance;
- `unsupported_providers`: required, sorted, unique array of canonical provider
  sources such as `registry.terraform.io/hashicorp/aws`;
- `entries`: required array ordered by dialect name then version.

At least one dialect entry or one unsupported provider is required. Empty
`entries` is meaningful only when configured metadata proved every observed
provider has no selected dialect. `unsupported_providers` records no
provider version, constraint, local name, alias, declaration, or behavior.

Each dialect entry contains:

- lowercase dialect `name`;
- exact `x.y.z` `version`;
- semantic `digest`;
- optional `presentation_digest`;
- optional `artifact` acquisition pin;
- optional canonical `origins` array naming source references that supplied
  exact entry metadata.

`index` and `sources` are mutually exclusive. Current initialized locks use
`sources`; earlier format-1 locks with singular `index` remain valid. Each
source contains `kind` (`index` or `dialect`), canonical full OCI `reference`
with tag or SHA-256 digest, and exact `manifest_digest` resolved for that
operation. If `sources` exists, every entry has at least one known origin. A
direct dialect source must map to exactly one entry with same artifact
repository and manifest digest. Credentials, registry tokens, Docker config
paths, retrieval times, and full OCI manifests are never lock fields.

Artifact pin contains exact OCI `repository`, `manifest_digest`, `layer_digest`,
positive `download_size`, and positive `install_size`. Digests use lowercase
`sha256:<64 hexadecimal characters>`. Local authoring locks may omit index and
source provenance and artifact pins. Lock used to reacquire missing remote
content must contain complete artifact pins for that content.

For locked acquisition, `artifact.repository` is tagless OCI repository
location and `manifest_digest` is exact artifact identity. Each entry may name
different standards-compatible public or private repository. Client resolves
manifest by digest from that entry's repository; official repository and
top-level index/source provenance have no special role on this path. Registry
identity never replaces descriptor, archive, semantic, presentation,
dependency, or provider verification.

Source pins bound future unlocked discovery and upgrade. They do not route
locked acquisition: `artifact` remains sole acquisition authority. Index
sources may remain recorded even when they supplied no selected entry so
explicit upgrade can revisit same bounded set without scanning registries.

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
- same-version artifact content with another digest is never substituted;
- same name/version from multiple sources deduplicates only when complete
  metadata, artifact repository, and manifest digest agree; otherwise lock
  creation fails before selection;
- source and entry-origin arrays use canonical order and unique values.

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
`rootform init --source <reference>` adds one explicit dialect artifact or
dialect index during unlocked initialization and is repeatable. `--source` is
incompatible with `--locked`. Upgrade reuses only official source, recorded
source references, and newly supplied references; it never enumerates a
registry or credential configuration.

Canonical project markers are `rootform.lock` and `.rootform/dialects/` directly
beneath selected project root. No parent search occurs. Present vendored
directory is exclusive dialect source for `build`, `check`, and `run`; store,
cache, index, and registry never supply fallback. `rootform vendor dialects`
may explicitly materialize or repair only exact entries already pinned by lock,
using verified store or cache before each pin's artifact repository. It never
discovers another dialect, changes source, upgrades selection, or modifies lock.
Vendor replacement is transactional and preserves legal and notice files.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
