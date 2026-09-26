---
title: "Core concepts"
description: "Understand how plan and state evidence becomes architecture, comparison, and policy results."
---

Rootform reads a Terraform or OpenTofu plan JSON or state JSON and turns observed resource instances into architecture. It does not evaluate configuration source, so the input determines what Rootform can establish.

## From evidence to architecture

Rootform keeps four layers separate.

1. **Plan or state evidence** records instances, evaluated values, and sensitivity masks. A plan can also carry configuration references, prior state, and reported drift. An optional verified saved plan adds exact configuration traversals.
2. A [Dialect](concepts/dialects.md) applies Rules to matching instances. Its Rules classify instances with Concepts and establish architectural facts through declared emissions.
3. The [Rootform document](concepts/architecture-ir.md) records stages, Representations, facts, closures, provenance, diagnostics, and the Dialects used to interpret them.
4. [Comparisons](concepts/diff.md) read that meaning across stages or inputs. Selected [Policies](concepts/policies.md) evaluate it on one stage.

Neither comparison nor policy evaluation changes the architecture it reads. A saved document can be reopened without the original plan, state, or active Dialects.

## Every observed instance starts with a representation

Each managed or data resource instance in the supplied evidence has a Representation, identified by its Terraform instance address. Indexed instances are distinct: `aws_subnet.application[0]` and `aws_subnet.application[1]` cannot satisfy each other's facts or Policies. A Rule may add a Concept or facts, but a represented instance does not need either. A missing Rule leaves interpretation uncovered; it does not erase the instance.

A plan can describe a declaration without a planned instance. Rootform records whether its population is observed, proven zero, or unverified. It does not turn an unverified population into an empty one. An external endpoint inferred by a Dialect is another Representation, with disclosure limits set by that Dialect.

## References are evidence, not meaning

Suppose `aws_subnet.application.vpc_id` refers to `aws_vpc.main.id`. The AWS Dialect's subnet Rule can establish a network Context from the subnet to the VPC. The reference alone does not establish that Context. `depends_on`, provider metadata, and similar names are dependency or identity evidence, not architectural connections.

A plan's evaluated value can identify an endpoint. When that value is unknown until apply, `--plan-file` can verify the saved plan against the JSON export and recover a direct identity traversal. Rootform records whether a fact came from a value, a traversal, or both. A transformed expression or conflicting evidence cannot be treated as a proven direct connection. State JSON has evaluated values but no configuration traversals.

## Read each architectural connection precisely

| Structure | Question answered | What it does not imply |
| --- | --- | --- |
| **Representation** | Which instance or external endpoint is present? | That a Rule interpreted it or the Explorer always shows a card |
| **Context** | In which architectural frame is an instance placed? | Runtime reachability or a Terraform dependency |
| **Relation** | Which directed, Dialect-defined connection was established? | Every source reference between the instances |
| **Contribution** | Which Representation contributes to another? | That the contributor was absorbed or owned |
| **Composition** | Which proven members form a composed root? | That members inherit the root's Concept |

One instance can have Contexts in several dimensions. Contributions keep contributor and target distinct. The Explorer may reveal a secondary resource only when navigating its Context; the saved document still contains its Representation. See [Explorer navigation](guides/explore-architecture.md#reveal-a-secondary-resource).

## Rootform reports what evidence permits

Each active emission closes for each applicable instance. A `resolved` closure records a complete, nonempty fact set. `absent` means the relevant fact is proven absent. `indeterminate` means available evidence cannot finish the answer; proven facts from other elements may still be present. Reasons include an unknown value, a sensitive value, ambiguous or duplicate identity, and unavailable evidence.

An absent Context can support a Policy violation or a determined comparison. An indeterminate Context cannot justify a pass, a proven removal, or a no-change conclusion. An uninterpreted instance and an indeterminate emission are different: one lacks a matching Rule, while the other has a Rule whose evidence cannot settle its emission. [Architecture documents](concepts/architecture-ir.md#stages-and-facts) explains recorded closures.

## One input can contain several stages

A plan has a `planned` outcome and can also provide `refreshed` prior state. Rootform reconstructs `recorded` from drift reported in the plan when evidence permits; that reconstruction may be partial. A state JSON supplies one `recorded` stage. Rootform never refreshes these stages itself.

One plan can compare recorded to refreshed as reported drift, refreshed to planned as proposed change, and recorded to planned as net change. `rootform run a.json --diff b.json` instead compares selected stages of separate inputs. That [cross-input comparison](concepts/diff.md) cannot establish drift causation.

## Rootform does not run Terraform or OpenTofu

Rootform does not start Terraform or OpenTofu, execute providers, contact a backend, refresh state, or apply a plan. Your Terraform or OpenTofu workflow produces the plan or state export with the credentials and state access it already needs; Rootform then reads the resulting files locally. This boundary keeps architecture analysis away from credentials, state locks, and infrastructure changes. It also means Rootform cannot establish live health, runtime connectivity, or drift that the plan did not report. [Plan inputs](inputs/plans.md#produce-the-accepted-json) shows how to produce the accepted JSON.

## Determinism makes evidence reviewable

For the same supported input, optional saved plan, and exact Dialect selection, Rootform writes the same canonical document bytes. The document records what the input reports about completeness, whether a saved plan was verified, and the Dialect definitions used. A lock records exact project selection; it does not make incomplete plan evidence complete. Dialect evolution can change interpretation even when the infrastructure is unchanged: the Rootform binary fixes embedded Dialects, and [Install, add, and vendor](concepts/external-content.md) explains how selected and installed content differ.

Plans and state exports can contain cleartext secrets. Keep them out of Git and public artifacts. Rootform discards sensitive values before serializing documents or reports, but those outputs still disclose topology and names. See [Security](security/index.md#protect-plans-and-derived-outputs), then [choose an input](inputs/index.md) or [explore an architecture](guides/explore-architecture.md).
