# `rootform.lock` contract

Current format version: `1`.

`rootform.lock` is deterministic JSON recording the project's non-embedded
selections: local or OCI Dialects, local or OCI Policy Pack sources, excluded
owners, and explicit replacements. Embedded units (the RF Vocabulary and the
supplied Dialects of the Rootform release set) are never lock fields: they are
selected and upgraded as one release set, not per project. Terraform and
OpenTofu provider versions remain owned by source code and
`.terraform.lock.hcl`; they never enter this file.

The lock is not a semantic pin. Derived linking pins live in linked artifacts.
It records no toolchain pin, no release-set pin, no embedded unit version or
digest, and no unsupported-provider evidence.

## Top-level fields

- `format_version`: exact string `1`;
- `dialects`: required array of local or OCI Dialect selections;
- `policy_packs`: required array of local or OCI Policy Pack source
  selections;
- `excluded_owners`: required array of excluded Dialect owners;
- `replacements`: required array of replaced Dialect owners.

An empty lock is valid. A project with no non-embedded selection, exclusion, or
replacement does not need a lock for a normal `check`; the lock file may be
absent. `check --locked` requires an existing valid lock, including an empty
one. Absence is never transformed into an empty selection.

`rf` is reserved and may never appear as an excluded or replaced owner.

## Dialect selections

An OCI Dialect entry carries its owner, exact `x.y.z` `version`, exact
compiled-content `content_digest`, and complete artifact pin: tagless OCI
`repository`, `manifest_digest`, `layer_digest`, positive `download_size`,
and positive `install_size`. Digests use lowercase `sha256:<64 hex>`.

A local Dialect entry carries its owner, exact `x.y.z` `version`, exact
`content_digest`, and a relative `local.path`. Local authoring locks omit
acquisition artifacts.

An excluded owner removes that unit's knowledge from the effective catalog
without removing resource bases. A replacement names the replaced owner; the
replacement unit is itself a selected Dialect with its own origin, versions,
and digests. A collision of owners without an explicit replacement is an error.
`rf` is neither replaceable nor excludable.

## Policy Pack source selection

Each selected pack source carries lowercase pack `name`, exact `x.y.z`
`version`, content `content_digest`, and its `local` or `oci` source. The
source declares no semantic dependency versions; RF Vocabulary and Dialect
dependencies are derived at linking and recorded in the linked artifact, never
as independent project selections.

Pack selection is never automatic: only pack sources recorded in this section
or named explicitly are evaluated. `build` and `run` ignore Policy Packs, so
governance selection never changes Architecture IR.

## Validation and identity

- one entry per Dialect owner and one pack source per pack name;
- Dialects, packs, exclusions, and replacements use strict canonical order;
- unknown fields, duplicate JSON keys, trailing values, invalid names,
  versions, digests, sizes, paths, and noncanonical order are rejected;
- whitespace and object-field order are insignificant;
- content and artifact digests verify independently;
- acquisition metadata never changes semantic identity;
- selected OCI content with another digest is never substituted;
- a local or OCI source whose current digest drifts from a locked digest is a
  selection/integrity error; a relink never adopts it silently;
- any missing, extra, changed, or differently versioned locked selection makes
  locked execution incoherent and refuses `--locked`.

Current shape is format 1. `rootform init --locked` never creates, normalizes,
or modifies lock. Unknown formats, malformed input, and current code
incompatible with locked selection fail before acquisition and are never
overwritten.

## Preparation and mutation

Directory `build`, `check`, `run`, and explicit `init` use the same
preparation service. `check` never accesses the network, creates or rewrites
the lock, and never mutates a selection to resolve an incompatibility. Its only
implicit preparation writes are local deterministic linking and the derived
`linked artifact` cache; explicitly requested outputs remain separate.

Preparation of external contents is an explicit operation. `rootform init`
verifies every exact existing selection and may acquire a missing OCI package
only from the immutable repository and manifest digest already recorded in the
lock. `rootform vendor` materializes those same exact selections under the
project. `--offline` permits only verified local entries. `--locked` requires
the lock and freezes its bytes; it does not prevent explicit exact acquisition
by `init`. Automatic linking stays local and never changes locked sources.

`rootform init` prepares exact existing selections; it does not detect
providers, resolve versions, create a lock, or modify one. A missing lock means
an empty selection unless `--locked` requires the file.

Canonical project marker is `rootform.lock` directly beneath the selected
project root. No parent search occurs.

Canonical vendor paths are `.rootform/dialects` and
`.rootform/policy-packs`. Vendor materializes only selected non-embedded
Dialects and Policy Pack sources, with licenses and notices. It never
materializes toolchain, RF Vocabulary, supplied Dialects, or linked-artifact
cache. When used, each vendored tree is exclusive for its selected kind;
missing or divergent content never falls back silently to store, cache, or
registry. Vendor preserves exact pins without discovery, upgrade, or lock
mutation.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
