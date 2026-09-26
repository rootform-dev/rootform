---
title: "Reproduce an analysis offline"
description: "Replay a saved Rootform document or analyze the same producer export with fixed selection."
---

Keep the exact plan or state JSON, optional saved plan, Rootform version, and selection lock used for an analysis. A saved format-1 Rootform document can be reopened without the producer export or installed Dialects:

```sh
rootform run architecture.json --no-serve -o report.md
```

To reanalyze the producer evidence, prepare exact selected content before disconnecting. Then run the same input with a fresh Rootform home and `--locked`:

```sh
rootform init . --locked --offline --no-input
rootform run plan.json --plan-file plan.tfplan --require-enrichment --locked --no-serve -o replay.json
```

Compare document hashes only when binary, Dialect selection, producer input, and saved-plan verification match. Plan and state exports can contain cleartext secrets; transfer and retain them under the same controls as state. Rootform output masks sensitive values. A mismatch in semantic selection or unavailable traversal evidence can make facts or comparisons indeterminate. See [Offline and security](../offline-security.md).
