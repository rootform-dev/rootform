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

`v1` does not exist until owner publishes it. During private migration, tests
use exact commit and optional private-read credential. Public beta installation
requires no account or entitlement.
