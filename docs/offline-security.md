# Offline and security model

Rootform compilation reads local Terraform/OpenTofu sources, local architecture
documents, local locks, and local dialects. Directory forms of `build`, `check`,
and `run` first enter explicit project-preparation phase. Coherent local project
takes silent zero-network path; incomplete project may acquire verified
dialects before compilation. LSP, policy over existing document, diff, explain,
and rendering or serving already built architecture never acquire dialects.

`rootform init` and shared preflight are only acquisition boundaries. Normal
preparation may contact official OCI distribution and explicit or recorded OCI
sources. `--offline` and
`ROOTFORM_OFFLINE=1` use only project-vendored dialects, installed store, cached
archives, and cached index. Missing content fails with exact missing references.
`--locked --offline` fixes both lock selection and acquisition input. CI implies
no input, never offline.

`--locked` requires existing lock and forbids lock changes while allowing exact
locked downloads from each artifact pin's repository and manifest digest unless
offline. This path never reads mutable index or source reference. No-input normal command may create
absent lock from unique recommendations, but never changes existing one; explicit
`rootform init --no-input` is required for deterministic update. Network or
integrity failure leaves no partially visible store, vendor, or lock.

Online OCI authentication reads standard Docker configuration only. Non-empty
`DOCKER_CONFIG` takes precedence over current user's `~/.docker/config.json`;
host `credHelpers`, global `credsStore`, then matching `auths` determine
identity. Helper/store error never falls through to another configured identity.
Rootform invokes helper `get` only, captures helper output, and keeps decoded
credentials and ORAS Basic/Bearer tokens in process memory. It emits and stores
no credential, Authorization header, Docker config content, or config path.
Offline mode creates no registry client and reads no credential source.

Default home is `~/.rootform/` (`%USERPROFILE%\.rootform` on Windows):

```text
dialects/  immutable installed name/version content
cache/     redownloadable content-addressed OCI data
indexes/   cached official and explicitly configured source snapshots
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
