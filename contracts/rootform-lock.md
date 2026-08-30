# `rootform.lock` contract

Current format version: `1`.

`rootform.lock` is deterministic JSON pinning exact resolved dialect semantic
and presentation content.

Each entry contains lowercase dialect `name`, exact `x.y.z` `version`, semantic
`digest`, and `presentation_digest`. Digests use lowercase
`sha256:<64 hexadecimal characters>`.

Rules:

- at least one entry;
- one entry per dialect name;
- entries strictly ordered by name then version;
- unknown fields, duplicate JSON keys, trailing values, invalid names,
  invalid versions, and noncanonical order are rejected;
- whitespace and object-field order are insignificant;
- semantic and presentation digests verify independently;
- missing, extra, changed, or differently versioned dialect refuses consuming
  run;
- lock verification performs no install, repair, update, or network fetch.

Canonical project markers are `rootform.lock` and `.rootform/dialects/` directly
beneath process working directory. No parent search occurs.

Machine schema: [`../schemas/rootform-lock.schema.json`](../schemas/rootform-lock.schema.json).
