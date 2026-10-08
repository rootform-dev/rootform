# Official Rootform Dialects

This directory contains the maintained official Dialect sources distributed
with Rootform. Each owner keeps its own semantic version and content identity;
there is no collection version.

Sources use the native `.rf.hcl` format. `dialects.json` is the release-set
inventory used to build Rootform's embedded semantics. `evidence/` and
`fixtures/` hold public validation evidence for these sources.

Third-party Dialects and explicit replacements use the OCI distribution
contract documented by the parent Rootform repository. They are not copied
into this directory.

## Fixtures

Each directory under `fixtures/` is a Terraform configuration that proves what
the Dialects make of it. A maintainer plans every fixture offline with
Terraform:

```sh
ROOTFORM_BIN=/path/to/rootform bun run generate:plan-fixtures [filter ...]
```

The generator writes `offline.tf`, placeholder configuration for every provider
the fixture does not configure itself, and records the provider checksums in
`.terraform.lock.hcl`. It plans in a sandbox that refuses every connection
except loopback, with a scrubbed environment and a scratch home, then records
`plan.json`, `plan.tfplan` and `analysis.golden` beside the source.
Providers that call their API while configuring themselves (Okta, Snowflake
and HCP) talk to a loopback stand-in. A few provider settings keep planning
offline: the AWS provider retries once (`max_retries = 1`), the Datadog
provider skips credential validation (`validate = false`), and Cloud Control
resources carry their schema inline.

Fixtures never name an existing cloud object. A value known only after apply
comes from a `terraform_data` resource, and a data source that must read such a
value waits for it through `depends_on`, so Terraform defers the read instead of
calling the provider. Ephemeral resources receive unknown configuration for the
same reason.

`analysis.golden` records the analysis `rootform test --update` writes: the
analysis of the plan, with the saved plan verified against it, keeping only the
Dialect definitions it reaches. `rootform test dialects/fixtures` replays every
planned fixture. After a Dialect or Engine change, record the goldens again
without planning:

```sh
ROOTFORM_BIN=/path/to/rootform bun run update:goldens
```

`evidence/plan-fixture-inventory.json` lists every fixture with the digest of
its source, its providers and its outcome. A fixture that cannot plan offline
keeps its source, records why with the status `not_planned`, and proves nothing:
verification reports every scenario naming it as not verified. Resource types a
provider refuses to create are left out of the fixtures, and their rules stay
without fixture evidence.

On macOS the sandbox is `sandbox-exec`. On Linux it is `unshare --net`, whose
network namespace also cuts the loopback stand-in off, so the Okta, Snowflake
and HCP fixtures plan only on macOS.
