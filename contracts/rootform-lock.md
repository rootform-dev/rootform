# `rootform.lock` contract

Current format version: `2`.

`rootform.lock` is deterministic JSON pinning exact Rootform dialect semantic,
presentation, and optional acquisition identities. It is authoritative for
Rootform dialects only. Terraform and OpenTofu provider versions remain owned
by source code and `.terraform.lock.hcl`; they never enter this file.

## Top-level fields

- `format_version`: exact string `2`;
- `index`: optional acquisition provenance containing OCI `repository` and
  exact `manifest_digest`;
- `entries`: non-empty array ordered by dialect name then version.

Each entry contains:

- lowercase dialect `name`;
- exact `x.y.z` `version`;
- semantic `digest`;
- optional `presentation_digest`;
- optional `artifact` acquisition pin.

An artifact pin contains exact OCI `repository`, `manifest_digest`,
`layer_digest`, positive `download_size`, and positive `install_size`. Digests
use lowercase `sha256:<64 hexadecimal characters>`. Local authoring locks may
omit index and artifact pins. A lock used to reacquire missing remote content
must contain complete artifact pins for that content.

## Validation and identity

- one entry per dialect name;
- entries strictly ordered by name then version;
- unknown fields, duplicate JSON keys, trailing values, invalid names,
  invalid versions, invalid digests, non-positive sizes, and noncanonical order
  are rejected;
- whitespace and object-field order are insignificant;
- semantic and presentation digests verify independently;
- acquisition metadata never changes semantic or presentation identity;
- missing, extra, changed, or differently versioned dialects refuse a
  consuming run;
- same-version artifact content with another digest is never substituted.

Normal `rootform init` may migrate one valid format-1 lock to format 2 while
resolving current acquisition evidence. `rootform init --locked` never migrates,
creates, or modifies a lock. Malformed and unknown lock formats fail before
acquisition and are never overwritten.

Compilation, policy, diff, and run commands verify local locked content without
install, repair, update, or network access. `rootform init` is the only command
in this contract that may acquire missing dialect content.

Canonical project markers are `rootform.lock` and `.rootform/dialects/` directly
beneath the selected project root. No parent search occurs. A present vendored
directory is the exclusive dialect source for that project.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
