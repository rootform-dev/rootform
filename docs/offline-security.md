# Offline and security model

Rootform compilation reads local Terraform/OpenTofu sources, local architecture
documents, local locks, and local dialects. Directory forms of `build`, `check`,
and `run` first enter explicit project-preparation phase. Coherent local project
takes silent zero-network path; incomplete project may acquire verified
Dialects, and `check` may also acquire selected Policy Packs. `build` and `run`
ignore governance. The language server is pack-less: it never loads, evaluates,
or requires Policy Packs. Policy evaluation over an existing document, diff,
explain, and rendering or serving already built architecture never acquire
Dialects or Policy Packs.

`rootform init` and shared preflight are only project acquisition boundaries.
Normal preparation may contact official OCI distribution and explicit or
recorded OCI sources and explicit or recorded policy-pack references. Authoring
commands `rootform publish dialects` and `rootform publish policy-packs` are
separate explicit registry-write boundaries; package and publish `--dry-run`
remain offline. `--offline` and
`ROOTFORM_OFFLINE=1` use only project-vendored dialects and policy packs,
installed store, cached archives, and cached index. Missing content fails with
exact missing references. `--locked --offline` fixes both lock selection and
acquisition input. CI implies no input, never offline.

`--locked` requires existing lock and forbids lock changes while allowing exact
locked downloads from each artifact pin's repository and manifest digest unless
offline. This path never reads mutable index or source reference. No-input
normal command may create absent lock from unique recommendations, but never
changes existing one; explicit `rootform init --no-input` is required for
deterministic update. Network or integrity failure leaves no partially visible
store, vendor, or lock.

## OCI mirrors for locked projects

Rootform supports a mirror through exact lock routing, not source priority.
First copy every artifact descriptor graph named by the lock to one
standards-compatible mirror repository without repackaging it. Verify that each
copied manifest retains its locked digest. Then change only
`entries[].artifact.repository` in `rootform.lock` to the tagless mirror
repository. Keep manifest and layer digests, sizes, semantic and presentation
digests, versions, `sources`, and `origins` unchanged. Review and commit that
lock change.

Validate the mirror from an empty store:

```sh
ROOTFORM_HOME=/path/to/empty-rootform-home \
  rootform init . --locked --no-input
```

Locked recovery contacts only each entry's rewritten repository at its exact
manifest digest. It does not read the recorded index, contact the original
artifact repository, or fall back there when the mirror is missing, unreachable,
or corrupt. After this acquisition, either retain the verified home or run
`rootform vendor dialects`; subsequent `--locked --offline` commands need no
registry or credentials.

Do not add a rewritten copy of the official index with `--source`. The official
index remains implicit, and same name/version entries from different artifact
repositories are an intentional source conflict even when their content
digests match. This strict rule prevents source priority from silently changing
artifact identity.

Online OCI authentication reads standard Docker configuration only. Non-empty
`DOCKER_CONFIG` takes precedence over current user's `~/.docker/config.json`;
host `credHelpers`, global `credsStore`, then matching `auths` determine
identity. Canonical `credentials not found` means no identity and permits
anonymous registry authentication; it never falls through to inline
credentials. Helper/store execution or decoding error never falls through to
another configured identity.
Rootform invokes helper `get` only, captures helper output, and keeps decoded
credentials and ORAS Basic/Bearer tokens in process memory. It emits and stores
no credential, Authorization header, Docker config content, or config path.
Policy-pack acquisition and publication use this same authentication path;
there is no pack-specific credential flag.
When `SSL_CERT_FILE` is set online, Rootform appends its bounded PEM bundle to
system roots; invalid content fails with a sanitized error. Offline mode creates
no registry client and reads neither credential source nor TLS bundle.

Default home is `~/.rootform/` (`%USERPROFILE%\.rootform` on Windows):

```text
dialects/  immutable installed name/version content
policy-packs/
           immutable installed name/version pack content
cache/     redownloadable content-addressed OCI data
indexes/   cached official and explicitly configured source snapshots
tmp/       staging invisible until atomic commit
```

`ROOTFORM_HOME` replaces this path. Installed versions stage and verify before
atomic rename. Existing same-version content is never silently replaced.
Project `.rootform/dialects/` is exclusive for `build`, `check`, and `run` when
present. Project `.rootform/policy-packs/` is exclusive execution source for
project `check` and policy listings when present; `--policy-pack <directory>`
selects an unpackaged local pack for read-only authoring forms. Missing or
changed vendor content fails before registry credential access; no store,
cache, index, or registry fallback occurs. Explicit `rootform vendor dialects`
and `rootform vendor policy-packs` may repair exact lock pins from verified
local material or recorded registry, unless offline, and replace vendor
transactionally without changing lock.

Raw secrets, sensitive values, HCL ASTs, plans, and state never enter browser
payloads, logs, architecture documents, or exported HTML. Inputs are bounded;
invalid or incomplete evidence fails explicitly.

HTML export is self-contained and loads no CDN or sibling asset. Local server
binds loopback only. Terraform and provider executables are not invoked.

Report vulnerabilities privately per [`../SECURITY.md`](../SECURITY.md).
