---
title: "Security and local operation"
description: "Understand what Rootform reads, when it uses the network, and what leaves the command."
---

Rootform analyzes local inputs without telemetry, a cloud account, or provider
execution. That does not mean a first run never uses the network: project
preparation may acquire the exact Dialects and selected Policy Packs it needs.

## Know which operation uses the network

| Operation | Network boundary |
| --- | --- |
| Prepare a project | May contact configured registries to resolve and acquire Dialects and selected Policy Packs. Registry authentication and certificate settings apply. |
| Build with `--locked --offline` | Uses the existing lock and permitted local content. Missing bytes cause failure. |
| Explore a directory with `rootform run .` | May prepare missing Dialects, then serves architecture and renderer assets on local loopback. |
| Explore saved JSON with `rootform run architecture.json` | Acquires no Dialects or Policy Packs; serves saved facts and renderer assets on local loopback. |
| Open an exported HTML file | The file contains the architecture and its browser assets; no CDN is needed. |

Rootform does not contact a provider API to fill a gap in the input. Preparing
Terraform modules or producing a plan with Terraform/OpenTofu is a separate
operation with that tool's own credentials and network behavior.

## Control acquisition

Use `--locked` to preserve an existing selection and `--offline` to prevent
network access. They solve different problems. Read
[locks, vendor, and offline operation](../offline-security.md) before setting
up a restricted environment. [Registry compatibility](../integrations/registry-compatibility.md)
records the tested protocol boundary.

## Protect outputs

Raw source, sensitive values, plans, and state do not enter the browser payload.
The architecture still describes resource identities, structure, and provenance.
Treat it as infrastructure information when sharing an HTML file or CI artifact.

For example, a resource address, service name, file path or relationship can
reveal how a private system is organized. Value suppression does not anonymize
those identities. Review JSON, HTML, Diff reports and diagnostics before sharing
them outside their intended audience. Exported HTML gives its recipient the
architecture data as well as the picture.

Keep raw plan exports separate from architecture artifacts. A Terraform/OpenTofu
JSON plan can contain sensitive values even when a human-readable plan hides
them. The [plan guide](../inputs/plans.md#protect-the-plan-files) explains the
boundary. Do not attach raw plans or state to public reports.

Self-contained HTML loads no CDN assets. The live explorer binds to loopback.
Rootform does not apply configuration or contact your cloud provider to verify
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
facts and policy outcomes you expect, including unsupported declarations and
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
