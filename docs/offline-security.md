# Offline and security model

Rootform compilation reads local Terraform/OpenTofu sources, local architecture
documents, local locks, and local dialects. Build, check, run, LSP, policy,
diff, explain, HTML export, and local server never acquire dialects or perform a
network fetch.

`rootform init` is the explicit acquisition boundary. Normal init may contact
official OCI distribution. `rootform init --offline` and
`ROOTFORM_OFFLINE=1` use only project-vendored dialects, installed store,
cached archives, and cached index. Missing content fails with exact missing
references. `--locked --offline` freezes both resolution and acquisition input.

Default home is `~/.rootform/` (`%USERPROFILE%\.rootform` on Windows):

```text
dialects/  immutable installed name/version content
cache/     redownloadable content-addressed OCI data
indexes/   cached official recommendation index
tmp/       staging invisible until atomic commit
```

`ROOTFORM_HOME` replaces this path. Installed versions stage and verify before
atomic rename. Existing same-version content is never silently replaced.
Project `.rootform/dialects/` is exclusive when present; vendor and lock update
transactionally.

Raw secrets, sensitive values, HCL ASTs, plans, and state never enter browser
payloads, logs, architecture documents, or exported HTML. Inputs are bounded;
invalid or incomplete evidence fails explicitly.

HTML export is self-contained and loads no CDN or sibling asset. Local server
binds loopback only. Terraform and provider executables are not invoked.

Report vulnerabilities privately per [`../SECURITY.md`](../SECURITY.md).
