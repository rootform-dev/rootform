# Offline and security model

Rootform runtime reads local Terraform/OpenTofu sources, local architecture
documents, local locks, and local dialects. After explicit release and dialect
download, compilation, policy, diff, explain, HTML export, and local server
perform no network fetch.

Raw secrets, sensitive values, HCL ASTs, plans, and state never enter browser
payloads, logs, architecture documents, or exported HTML. Inputs are bounded;
invalid or incomplete evidence fails explicitly.

HTML export is self-contained and loads no CDN or sibling asset. Local server
binds loopback only. Terraform and provider executables are not invoked.

Report vulnerabilities privately per [`../SECURITY.md`](../SECURITY.md).
