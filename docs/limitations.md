---
title: "Limitations"
description: "Understand what plan and state analysis can establish and what to use when evidence is incomplete."
---

A Rootform document describes the architecture established by its plan or state JSON and active Dialects. A successful analysis is bounded by that input. The limits below change how to interpret a missing fact, policy outcome, or comparison.

## Does Rootform see deployed infrastructure?

No. Rootform never runs Terraform or OpenTofu, executes providers, refreshes state, contacts a backend or cloud, or applies changes. A plan describes one proposed outcome and may include the state observed during that planning run. A state JSON describes one recorded snapshot. Use your infrastructure tooling for live health, reachability, and current-state questions, then analyze a fresh export when you need its architecture. [Choose an input](inputs/index.md) distinguishes the two forms.

## Which input forms can Rootform analyze?

`run` accepts a plan JSON export, state JSON export, saved Rootform document, or `-` for standard input. It refuses a configuration directory, binary saved plan, raw state file, plan event stream, malformed JSON, and an errored plan. An encrypted or unreadable saved plan cannot supply optional configuration traversal evidence. Export the plan or state with `terraform show -json`; OpenTofu users run the same command with `tofu`. [Plan inputs](inputs/plans.md) shows the exact pair. Plan and state JSON can contain cleartext secrets, so keep them out of Git and public artifacts.

## What do incomplete plans and deferred actions mean?

A planned instance may be known, carried from the refreshed stage, removed by an explicit delete, or deferred. Rootform does not infer a plan mode from missing entries. Terraform can report completeness; OpenTofu may not. A missing planned instance is not necessarily proof that no instance exists, especially with targeted, excluded, or deferred work. Use a complete plan for absence-sensitive decisions and inspect each stage's completeness before accepting a negative policy result. `--plan-complete=attested` records an explicit operator claim; it does not discover omitted instances.

## When can a saved plan establish a reference?

Plan JSON often gives values but cannot distinguish a direct resource traversal from a transformed expression. A verified `--plan-file` lets Rootform inspect the configuration snapshot captured in that saved plan. It can follow a direct traversal, including supported pass-through through variables, locals, and module outputs, on the `planned` stage. Functions, operators, conditionals, `try`, splats, dynamic blocks, computed indexes, and other transformed expressions do not establish an endpoint merely because their reference list names one. Use evaluated identity values where possible; otherwise leave the closure indeterminate and inspect the source expression. A saved plan must verify against the exact JSON export; `--require-enrichment` makes refusal an error.

Several static nested blocks represented as a set may be reordered when exported. Without a provider schema to map source positions, Rootform establishes an endpoint only when all candidate blocks agree. Use a direct, unambiguous expression where the provider allows it, or accept an indeterminate closure. [Architecture documents](concepts/architecture-ir.md#stages-and-facts) explains closure outcomes.

## Where does provider configuration stop?

Plan JSON records provider configuration expressions, not their evaluated values. A `provider.<path>` Rule can establish a planned-stage endpoint only through a direct traversal in a verified saved plan. Literal or transformed provider hosts, state input, historical stages, OpenTofu provider `for_each`, and JSON configuration syntax leave that closure indeterminate with reason `unavailable`. Rootform does not read literal provider configuration values because it cannot identify sensitive provider attributes from the plan export. Keep the missing relation unresolved; inspect provider configuration in your own tooling instead of treating a dependency as a network fact.

## Instances without Rules

Every managed or data instance gets a [Representation](concepts/architecture-ir.md#accounting-keeps-partial-knowledge-honest) in the Rootform document. Without an applicable Rule it has no derived Concept or architectural facts. A policy targeting those facts cannot call the instance compliant from its source type alone. Inspect the instance with `rootform explain architecture <address> --input analysis.json`, then assess Dialect coverage. A secondary resource may be represented without a permanent card in every Explorer scene; [reveal it on demand](guides/explore-architecture.md#reveal-a-secondary-resource).

## Why can a closure remain indeterminate?

Unknown until apply and sensitive values cannot prove an endpoint. An unavailable path, duplicate identity, or an eligible candidate with unknown identity prevents unique matching. A known value that conflicts with a verified traversal is also unresolved. External endpoints are allowed only when the Dialect explicitly permits them and no eligible in-scope candidate remains unresolved. Identity matching normally stays within one provider configuration; a declared global identity or verified traversal can cross that boundary. An external endpoint says the reference is outside this inventory, not that a remote object exists or is healthy. Read the closure reason and [diagnostics](language/reference/diagnostics.md), then obtain better input or adjust a reviewed Dialect Rule.

## Why was a policy not evaluated or indeterminate?

No selected Policy Pack means no evaluation. A selected policy with zero matching targets has no decision. Unknown facts, unverified population, or an indeterminate closure can prevent a Boolean answer. A violation remains a violation when another evaluation is indeterminate. Inspect selected policy and target counts; status `3` is not approval. [Policy outcomes](concepts/policies.md#evidence-produces-three-outcomes) explains the evaluation model.

## What do drift and comparisons exclude?

Drift is a change outside Terraform or OpenTofu reported between the plan's recorded and refreshed stages. A missing drift record does not prove none occurred: refresh may be disabled or limited, and data sources and deposed objects are outside reported drift coverage. The reconstructed recorded stage can be partial. A `run --diff` comparison joins selected stages of separate inputs; it is not drift.

Comparisons use architectural facts under the active Dialects, not raw Terraform actions. A provider replacement may leave architecture unchanged. Different Dialect selections, withheld external identities, or unresolved facts can yield `undetermined`, never a proven no-change result. Compare with the same release and selection where possible, and read `problems` and `undetermined` entries. [Architecture comparisons](concepts/diff.md) explains those outcomes.

## What does offline guarantee?

Normal `run` does not acquire packages. `init` and `vendor` can acquire exact selected OCI content unless `--offline` forbids it. `--locked` requires an unchanged selection but does not itself disable acquisition. A container image pull, Terraform or OpenTofu command, or artifact upload has its own network boundary. [Locks and vendored content](offline-security.md), [Container image](integrations/oci-image.md#run-with-vendored-content-offline), and [security and data handling](security/index.md#know-which-operation-crosses-a-network-boundary) show how to prepare a disconnected run.
