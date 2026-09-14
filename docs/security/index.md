---
title: "Security and data handling"
description: "Understand what Rootform reads, when it uses the network, and what leaves the command."
---

Rootform analyzes local inputs without telemetry, cloud account, provider
execution, or implicit package acquisition. Only explicit preparation,
vendoring repair, and publication cross a registry boundary.

## Know which operation uses the network

| Operation | Network boundary |
| --- | --- |
| `rootform init --locked` | May contact the recorded repository to acquire exact manifest digests already in lock. |
| `build`, `check`, `diff`, `explain`, `list`, `show`, `validate`, and `test` | Read embedded, local, installed, or vendored exact inputs; never acquire. |
| `rootform run` | Serves one local architecture over loopback only; makes no outbound connection. |
| `rootform vendor dialects` or `rootform vendor policy-packs` | Materialize verified local or installed bytes; may download only the exact manifest digest recorded in lock when a pin is missing. |

Rootform does not contact a provider API to fill a gap in the input. Preparing
Terraform modules or producing a plan with Terraform or OpenTofu is a separate
operation with that tool's own credentials and network behavior. Packaging a
Dialect or Policy Pack is local; only `rootform publish` writes to a
registry.

## Control acquisition

Use `--locked` to require an existing selection. Use `--offline` on init
and vendor to forbid optional repair acquisition. Read
[locks, vendor, and offline operation](../offline-security.md) before setting
up a restricted environment, and
[add a third-party Dialect or Policy Pack](../guides/external-content.md) to
review what a lock selects. [Registry compatibility](../integrations/registry-compatibility.md)
records the tested protocol boundary. [Reproduce a build offline](../guides/reproduce-build.md)
shows how to transfer a checked selection.

## Protect plans and outputs

Saved plan files and their JSON exports can contain sensitive values, even when
Terraform or OpenTofu hides them in terminal output. Keep both out of Git and
public artifacts. Raw source, sensitive values, plans, and state are not copied
into Rootform outputs. Architecture IR and Diff reports describe resource
identities, structure, and provenance; treat them as infrastructure information
when sharing JSON or CI artifacts. The [plan guide](../inputs/plans.md#protect-the-plan-files)
explains the protected boundary. Do not attach raw plans or state to public
reports.

A resource address, service name, file path, or relationship can reveal how a
private system is organized. Value suppression does not anonymize those
identities. Review JSON, Diff reports, and diagnostics before sharing them
outside their intended audience.

Rootform does not apply configuration or contact a cloud provider to verify
that the architecture is deployed.

## Review the Dialects and Policy Packs you trust

A Dialect determines which architectural claims Rootform establishes. A Policy
Pack determines which assertions a check evaluates. Review their sources,
coverage and assumptions before adopting them. A package that interprets a
declaration incorrectly can produce a reproducible but misleading result.

Dialect and Policy Pack artifacts contain bounded Rootform language data; they
do not execute provider binaries, shell commands, or package-supplied code.

Digests identify exact package bytes. They do not establish that a rule is
correct or appropriate for your infrastructure. A lock preserves reviewed
selection; it does not replace that review. Use a known example to confirm the
facts and policy outcomes you expect, including base-only declarations and
zero-evaluation cases.

Provenance answers why Rootform made a claim. It is evidence to inspect, not a
statement that the deployed resource is healthy or reachable. See
[Dialect interpretation](../concepts/dialects.md) and
[policy claim scope](../concepts/policies.md#know-the-scope-of-a-claim).

## Share a useful reproduction

Reduce a failure to synthetic configuration and record the executable version,
command, exit status and sanitized diagnostic. Preserve the relevant reference
or module shape while removing customer names and credentials. A small source
example is easier to verify than a screenshot of an unexplained failure.

Report vulnerabilities privately using the [security policy](../../SECURITY.md).
Use [troubleshooting](../troubleshooting/index.md) for ordinary failures and
[limitations](../limitations.md) for boundaries that are not errors.
