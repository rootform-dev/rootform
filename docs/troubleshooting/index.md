---
title: "Troubleshooting"
description: "Diagnose Rootform input, lock, package, policy, and Diff failures."
---

Keep command, exit status, stdout, and stderr together. Violation differs from
operation that could not decide.

## Wrong executable

Run `command -v rootform` (or `Get-Command rootform`) and `rootform version`.
Correct `PATH`; pin exact release in CI.

## Missing lock with locked command

`--locked requires rootform.lock` means chosen project root has no lock. Remove
`--locked` when supplied release set is enough, or author complete format-1 lock
for explicit Dialects/Policy Packs. `rootform init` never creates lock.

## Exact selected package missing

Compare lock with `rootform list dialects` and `rootform list policy-packs`.
From connected machine:

```sh
rootform init . --locked --no-input
```

Only exact OCI manifest digests already recorded can be acquired. No index,
version search, or substitution occurs.

## Vendor content missing or changed

Present `.rootform/dialects` or `.rootform/policy-packs` is exclusive for its
family. Repair explicitly:

```sh
rootform vendor dialects
rootform vendor policy-packs
```

Add `--offline` only when repair bytes already exist locally/cache. Vendor
commands preserve lock.

## Provider compatibility unverified

Check provider constraints and `.terraform.lock.hcl`. Missing version permits
static interpretation with unverified marker; reliable incompatible version
blocks affected Rule but keeps resource base. Rootform does not run provider or
refresh lock.

## Resource lacks architectural meaning

Every normalized resource should still have base representation. If no Rule
applies it has no Rule, Concept, or facts. Inspect source declaration,
interpretation status/candidates, diagnostics, and active Dialect owners.
Add reviewed Rule when evidence supports meaning; do not add match-only Rule for
visual coverage.

## Plan refused

Use `terraform show -json tfplan` or OpenTofu equivalent on saved plan. Raw
binary plan, `plan -json` event stream, state document, malformed JSON, and
unknown shape are rejected. Plans may contain sensitive values; keep input out
of public artifacts.

## Registry request fails

Inspect exact repository/digest, connectivity, `DOCKER_CONFIG`, credential
helper, and optional `SSL_CERT_FILE`. Helper failure is terminal. Offline init
does not inspect credentials.

See [OCI mirror](../offline-security.md#oci-mirror) for routing without digest
change.

## Policy evaluates nothing

Read `summary.policies`, `summary.evaluations`, and linked pins. No selected
pack means zero Policies. Selected Policy with no matching Concept/Rule target
means `not evaluated`. Both exit 3; machine result uses `not_evaluated` and
distinguishes them.

## Policy indeterminate

Read diagnostics and query completeness. Unknown traversal, unsupported query
contract, or semantic pin mismatch cannot become pass by dropping diagnostic.
Violation means assertion false over IR evidence, not opposite deployed fact.

## Diff has limitations

Two valid documents with differing semantic owners remain structurally
comparable but fact changes become undetermined. Different source normalization
can also limit continuity. This is valid nonempty report, not hard failure. Use
`--exit-code` to make changes or undetermined items return 1.

If unresolved, [report synthetic reproduction](../contributing/index.md#report-a-semantic-gap)
without credentials, raw plan, state, or private infrastructure.
