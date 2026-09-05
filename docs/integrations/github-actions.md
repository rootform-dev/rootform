# GitHub Actions integration

Official integration lives in `rootform-dev/action` and exposes two entrypoints.
Until its consumer release is tagged, pin reviewed commit
`71eef759bff5e73b27489b1f7de818a4a76dc2e9`:

```yaml
- uses: rootform-dev/action/setup@71eef759bff5e73b27489b1f7de818a4a76dc2e9
  with:
    version: 0.1.1

- uses: rootform-dev/action@71eef759bff5e73b27489b1f7de818a4a76dc2e9
  with:
    version: 0.1.1
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
