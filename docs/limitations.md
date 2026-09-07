---
title: "Current limitations"
description: "Know which conclusions Rootform can support and where evidence remains incomplete."
---

Rootform describes architecture established from its accepted inputs and
selected Dialects. Its confidence is bounded by that evidence.

## Declared architecture is not deployed state

Rootform does not apply configuration, query provider systems, or verify live
connectivity. A Terraform dependency is not automatically an architecture
relation. Plan JSON provides planned evidence, not a guarantee of the eventual
provider result.

## Coverage is explicit

Provider support is not universal resource coverage. A selected Dialect can
still leave declarations unsupported or evidence unresolved. Read source
accounting and diagnostics; do not treat an empty canvas or an indeterminate
check as success.

## Preparation has boundaries

Remote modules must already be materialized. Offline runs need the binary and
required content locally available. An existing vendor directory is exclusive,
so an incomplete vendor cannot silently fall back to the installed store.

## Comparison and presentation

Diff requires compatible architecture formats and the same exact Dialect set.
Large complete Plan views can require panning; Survey summarizes context to
stay readable. Renderer controls in the current implementation differ from
the public v0.1.1 release, as explained on [Install](installation.md).

Use [troubleshooting](troubleshooting/index.md) to distinguish an input failure
from one of these boundaries. Report reproducible gaps with synthetic examples
through [public contributions](contributing/index.md).
