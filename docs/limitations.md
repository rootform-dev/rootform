---
title: "Limitations"
description: "Understand the evidence boundary of plan and state analysis, drift, comparisons, and policies."
---

Rootform reports architecture established by the input and selected Dialects. It does not observe a live environment, run Terraform or OpenTofu, evaluate source configuration, execute providers, refresh state, contact a backend, or apply changes. It cannot prove deployed health, network reachability, or behavior.

## Plan and state scope

A plan JSON export describes the producer's proposed outcome. Its prior state can support `refreshed` and reconstructed `recorded` stages. A state JSON export gives one `recorded` snapshot. Neither input is a configuration directory. Producer exports can contain secrets; protect them even though Rootform masks sensitive values in its output.

Unknown until apply remains unknown. Sensitive values cannot resolve or disclose an endpoint. Without a verified saved-plan snapshot, Rootform cannot use configuration traversals to identify endpoints hidden by unknown or shared values. Even with the snapshot, transformed expressions, dynamic indexes, and ambiguous references may leave a closure indeterminate. An emission can describe a known external endpoint only when its Dialect permits that case; this does not verify the remote object.

An instance without an applicable Rule remains represented without a guessed Concept or fact. Policies targeting missing facts do not get a compliant result from an unmodeled instance. No selected or evaluated policies is not a pass. Inspect closure reasons, target counts, and diagnostics.

## Drift and comparisons

Drift means a producer-reported change made outside Terraform or OpenTofu between recorded and refreshed state in one plan with prior state. The reconstructed recorded stage may be partial. “No drift reported in this plan” carries the producer's scope; data sources and deposed objects are outside reported drift coverage, and absence of records is not proof of no drift. A comparison created with `run --diff` compares selected stages of separate inputs and is never called drift.

Architecture comparisons cover facts under the selected Dialects and available evidence. A provider replacement may have no architectural effect; a semantic selection change can make a comparison indeterminate. Unknown, sensitive, or incomparable candidate evidence never becomes a no-change claim.

## Offline operation

Normal analysis does not acquire packages. `init` or `vendor` can acquire exact selected OCI content unless offline controls forbid it. A valid lock fixes selection but does not disable acquisition. See [Locks and vendored content](offline-security.md).
