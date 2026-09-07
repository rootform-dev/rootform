---
title: "Security and local operation"
description: "Understand what Rootform reads, when it uses the network, and what leaves the command."
---

Rootform analyzes local inputs without telemetry, a cloud account, or provider
execution. That does not mean a first run never uses the network: project
preparation may acquire the exact Dialects and selected Policy Packs it needs.

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

Self-contained HTML loads no CDN assets. The live explorer binds to loopback.
Rootform does not apply configuration or contact your cloud provider to verify
that the architecture is deployed.

Report vulnerabilities privately using the [security policy](../../SECURITY.md).
Use [troubleshooting](../troubleshooting/index.md) for ordinary failures and
[limitations](../limitations.md) for boundaries that are not errors.
