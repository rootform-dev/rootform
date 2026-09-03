# Rootform in CI

All CI systems use same project lifecycle:

```text
verified exact Rootform binary or image
→ rootform init . --locked --no-input
→ rootform build . --locked --no-input
→ rootform check . --locked --no-input
```

Copy [`rootform-ci.sh`](rootform-ci.sh) to `ci/rootform-ci.sh`. It requires
committed `rootform.lock`, writes deterministic JSON under `.rootform-ci/`, and
does not prompt or update selection.

- Connected locked job may download exact artifacts pinned by lock.
- Vendored job sets `ROOTFORM_OFFLINE=1`; `.rootform/dialects/` becomes
  exclusive and no store, index, or registry fallback exists.
- `ROOTFORM_PROJECT` selects project directory and defaults to literal `.`.
- `ROOTFORM_BIN` selects already verified executable and defaults to
  `rootform`.

Examples:

- [GitHub Actions](github-actions.yml) installs exact release through
  checksum-verifying setup Action.
- [GitLab CI](gitlab-ci.yml) and
  [Azure Pipelines](azure-pipelines.yml) use exact official image tag.
- [Generic CI](generic-ci.sh) assumes exact checksum-verified binary is already
  on `PATH`.

For private image or dialect repositories, configure runner's Docker credential
file or helper. Rootform uses standard `DOCKER_CONFIG`; CI example never places
credential in arguments, lock, output, or vendor.
