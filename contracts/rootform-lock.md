# `rootform.lock` contract

Current format version: `1`.

`rootform.lock` is deterministic JSON pinning exact Rootform dialect semantics,
presentation, independent Policy Pack governance, optional acquisition
identities, and explicit provider non-coverage. It is authoritative for
Rootform Dialect and Policy Pack selections. Terraform and OpenTofu provider
versions remain owned by source code and
`.terraform.lock.hcl`; they never enter this file.

## Top-level fields

- `format_version`: exact string `1`;
- `index`: optional legacy singular index provenance containing OCI
  `repository` and exact `manifest_digest`;
- `sources`: optional canonical array of bounded OCI source provenance;
- `unsupported_providers`: required, sorted, unique array of canonical provider
  sources such as `registry.terraform.io/hashicorp/aws`;
- `entries`: required array ordered by dialect name then version;
- `policy_packs`: optional array ordered by pack name then version.

At least one dialect entry, unsupported provider, or Policy Pack entry is
required. Empty `entries` is meaningful when configured metadata proved every
observed provider has no selected dialect, or when lock records only a
governance artifact. `unsupported_providers` records no provider version,
constraint, local name, alias, declaration, or behavior.

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
source contains `kind` (`index`, `dialect`, or `policy-pack`), canonical full
OCI `reference` with tag or SHA-256 digest, and exact `manifest_digest`
resolved for that operation. Dialect origins reference only dialect/index
sources. Every Policy Pack artifact origin references exactly one direct
`policy-pack` source with same artifact repository and manifest digest.
Credentials, registry tokens, Docker config paths, retrieval times, and full
OCI manifests are never lock fields.

## Policy pack selection

`rootform.lock` records exact policy pack selection in a separate section from
dialect `entries`. Format version remains `1`; policy packs introduce no new
lock format version. The section lists each selected pack with lowercase pack
`name`, exact `x.y.z` `version`, content `digest`, and optional exact
`artifact` acquisition pin and canonical `origins`, without overlapping dialect
entries.

Dialect entries never carry, override, or append policy, and pack entries never
change dialect semantics. Pack selection is never automatic: only packs
recorded in this section or named explicitly are evaluated. A project may lock
dialects with no policy pack, or lock packs without altering dialect selection.
Canonical order, unique identity, digest, size, and artifact verification rules
apply to both sections. Missing, extra, changed, or differently versioned packs
make selection incoherent and refuse `--locked` execution, exactly as for
dialects.

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
incompatible with `--locked`. `rootform init --policy-pack <reference>` adds
one direct Policy Pack artifact during unlocked initialization and is
repeatable; it is also incompatible with `--locked`. Provider detection never
adds a Policy Pack. Upgrade reuses only official dialect source, recorded
dialect source references, and newly supplied references; it never upgrades
Policy Packs or enumerates a registry or credential configuration.

Canonical project markers are `rootform.lock` and `.rootform/dialects/` directly
beneath selected project root. No parent search occurs. Present vendored
directory is exclusive dialect source for `build`, `check`, and `run`; store,
cache, index, and registry never supply fallback. `rootform vendor dialects`
may explicitly materialize or repair only exact entries already pinned by lock,
using verified store or cache before each pin's artifact repository. It never
discovers another dialect, changes source, upgrades selection, or modifies lock.
Vendor replacement is transactional and preserves legal and notice files.

Canonical Policy Pack vendor path is `.rootform/policy-packs/`. Its presence is
exclusive for policy inspection and `check`; no store, cache, or registry
fallback occurs. `rootform vendor policy-packs` alone may repair that tree from
exact lock pins, without changing selection or lock bytes. `build` and `run`
ignore Policy Packs, so governance selection never changes Architecture IR.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
