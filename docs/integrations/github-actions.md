# GitHub Actions integration

Official integration lives in `rootform-dev/action` and exposes two entrypoints:

```yaml
- uses: rootform-dev/action/setup@v1
  with:
    version: 0.1.0

- uses: rootform-dev/action@v1
  with:
    version: 0.1.0
    path: ./infra
```

Setup resolves exact release, verifies checksum, and adds binary to `PATH`.
Main Action uses same installer, invokes CLI, writes Job Summary, and publishes
requested HTML, SARIF, and JSON artifacts without interpreting Terraform or
recomputing Rootform semantics.

Distribution candidate runs write one current evidence comment on their
associated pull request. The comment shows qualification gates, target archive
sizes and digests, license inventory count, workflow run, and draft release.
It exposes only opaque handoff digest and public distribution provenance; it
never includes private producer manifest fields. Subsequent runs update the
same comment.
