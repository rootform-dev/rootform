---
title: "Troubleshooting"
description: "Match a Rootform symptom to its exact diagnostic, evidence, and next action."
---

Keep the command, exit status, standard error, and Rootform document together. Status `1` can mean a confirmed policy violation, while `3` means refused input or no determinate decision. Status `4` is an output or server failure. [Outputs and exit status](../reference/outputs.md) gives the full contract.

## The command set differs from this documentation

Check which executable your shell runs and its version:

<!-- docs-check:troubleshooting-version -->
```sh
command -v rootform
rootform version
```

If help still lists an unexpected command or flag, fix `PATH` or use the intended exact release in automation. Do not reinterpret a diagnostic from a different binary.

## A directory or saved plan is refused as input

`run` needs plan JSON, state JSON, or a saved Rootform document. A configuration directory returns status `2` and the diagnostic `DIRECTORY_INPUT: use a Terraform or OpenTofu plan JSON or state JSON export`, followed by the commands to run. A binary saved plan returns status `3` with the same kind of guidance:

<!-- docs-check:troubleshooting-binary-input -->
```sh
rootform run plan.tfplan --no-serve
```

<!-- docs-output:troubleshooting-binary-input -->
```text title="Standard error"
rootform: INPUT_UNRECOGNIZED: zip archive, such as a saved plan

A saved plan is read with --plan-file, next to the plan JSON exported from it.

Try:
  terraform show -json plan.tfplan > plan.json
  rootform run plan.json --plan-file plan.tfplan
```

Run the two suggested commands: the first exports the JSON that Rootform analyzes, the second pairs it with the saved plan it came from. OpenTofu users run the export with `tofu`. The saved plan and JSON can contain cleartext secrets; keep them out of Git and public artifacts. [Plan inputs](../inputs/plans.md) gives the complete procedure.

## Malformed or unsupported JSON is refused

Malformed JSON returns `INPUT_UNRECOGNIZED: malformed JSON or trailing garbage`; a JSON object without plan, state, or Rootform document fields returns `INPUT_UNRECOGNIZED: JSON that is not a plan JSON, state JSON or Rootform document`; a text file such as `main.tf` returns `INPUT_UNRECOGNIZED: not JSON`. A state export from a working directory that has no state returns `INPUT_UNRECOGNIZED: state JSON without recorded state: the working directory that exported it has no state`, followed by the plan commands to run instead. The input kind is detected from content, not extension. A raw `terraform.tfstate` file and a `terraform plan -json` event stream are refused with the export commands to use instead. Re-export with `terraform show -json`, then confirm the file is complete before retrying. A plan with `errored: true` returns `PLAN_ERRORED: the plan JSON records that planning failed`; resolve the planning failure first rather than treating the result as an empty architecture.

## Saved plan verification fails

The saved plan named by `--plan-file` must be the one used to make that exact JSON export. A mismatched pair records `PLAN_PAIR_MISMATCH`. Without `--require-enrichment`, analysis continues with plan JSON alone and the summary says `Enrichment    saved plan refused (PLAN_PAIR_MISMATCH); analysis used the plan JSON alone`. With the requirement, it exits `3`:

<!-- docs-check:troubleshooting-pair -->
```sh
rootform run plan.json --plan-file other.tfplan \
  --require-enrichment --no-serve
```

<!-- docs-output:troubleshooting-pair -->
```text title="Standard error"
rootform: PLAN_PAIR_MISMATCH: saved plan refused; --require-enrichment requires a verified saved plan
```

Re-export JSON from the same saved plan, then retry. An unreadable or encrypted saved plan reports `PLAN_FILE_UNREADABLE`; use plan-only analysis if direct values suffice, or supply a readable matching pair. Never pair an arbitrary working directory with an old plan to establish references.

## An instance has no Rule

The analysis can succeed while a resource remains uninterpreted. The summary says `1 with no rule for their type` for a one-instance example, and `rootform explain architecture <address> --input analysis.json` says `Interpretation  none: no selected Dialect has a rule for this type`. Rootform still records a Representation for that instance. Confirm the active Dialects with `rootform list dialects -o wide`; add or author a reviewed Dialect only if its architectural meaning is needed. If the type is outside reviewed Rule coverage, [report a semantic gap](../contributing/index.md#report-a-semantic-gap).

## A resource has no card in the current scene

The Explorer shows one scene at a time, so a represented instance may have no card where you are looking. **Search** covers the whole architecture: search by name or type, then select the result to open its containing context. A secondary resource can also appear in the Inspector of the object it contributes to. `rootform explain architecture <address> --input analysis.json` confirms the instance in the saved document. A missing card alone is not a missing resource; see [Reveal a secondary resource](../guides/explore-architecture.md#reveal-a-secondary-resource).

## An expected relation is missing

Find the instance in the Explorer or run `rootform explain architecture <address> --input analysis.json`. Inspect each closure's Rule, `via` path, result, reason, and candidate counts. A Terraform dependency alone does not establish an architectural Relation. The active Dialect must emit it from values or a verified direct traversal. `EMISSION_PATH_UNDEFINED` means the path is absent from that instance's provider schema; `VIA_VALUE_SHAPE` means its shape cannot be read as endpoint identity. Correct the Dialect path or gather better input; do not add a guessed edge.

## Unknown or sensitive evidence leaves a closure indeterminate

One planned instance can report `indeterminate: unknown until apply` for a value computed later. A sensitive value is intentionally unavailable for endpoint matching and never printed. Rootform will not infer either from a reference list. Analyze a suitable later state JSON when it resolves the value, or keep the closure indeterminate. The [closure model](../concepts/forms.md#stages-and-facts) explains why `absent` differs from `indeterminate`.

## Provider configuration or historical evidence is unavailable

A `provider.<path>` emission can show `indeterminate: unavailable` when the plan has no verified saved-plan traversal, the expression is literal or transformed, or the selected stage is historical. State JSON contains no provider configuration. For a planned-stage question, supply the verified saved plan and inspect whether the provider expression directly names a resource. Rootform never reads literal provider configuration values just to force a relation.

## Duplicate, ambiguous, or conflicting identities

`DUPLICATE_IDENTITY` means more than one eligible instance has the same matched identity. `ambiguous_unknown` means at least one candidate could match but its identity is unknown, sensitive, or unavailable. `EVIDENCE_CONFLICT` means a verified traversal and a known value point at different endpoints; the closure reason is `reference_ambiguous`. Inspect the candidate counts and provider configuration scope, then correct the input or Rule identity declaration. None of these is a resolved relation.

## An external endpoint is denied

A known value with no in-scope match yields `external_denied` unless the emission declares `external = "allow"`. Even with that declaration, an eligible unknown in-scope candidate prevents an external endpoint. Confirm whether the target is genuinely outside this plan's inventory before changing a Dialect. An external endpoint does not verify the remote object.

## Locked project selection fails

`--locked` requires `rootform.lock` directly under the selected project root. Without it, `run` exits `3` and reports `SEMANTIC_SELECTION: the selected Dialects could not be loaded (rootform.lock is required by --locked)`:

<!-- docs-check:troubleshooting-locked -->
```sh
rootform run plan.json --locked --no-serve
```

<!-- docs-output:troubleshooting-locked -->
```text title="Standard error excerpt"
rootform: SEMANTIC_SELECTION: the selected Dialects could not be loaded (rootform.lock is required by --locked)
```

For embedded-only work, omit `--locked`. For an exact external selection, add content from the project root and commit the lock. If a selected local Dialect changed, the binary reports `selected dialect network-review differs from rootform.lock`; use an override while editing, then `rootform update dialect network-review` to record a reviewed change. `init` cannot adopt source drift.

## Selected content is missing

A locked run exits `3` when a selected Dialect or Policy Pack cannot be loaded, for example with `SEMANTIC_SELECTION: the selected Dialects could not be loaded (selected dialect network-review is unavailable locally)`. `rootform list` fails for the same reason, so read the entries in `rootform.lock` instead. For selected OCI content, run `rootform init --locked --no-input` from the project root to install the exact recorded digests; add `--offline` only when those bytes are already on this machine. `init` cannot choose another version or change the lock. A local source must be restored at its recorded path: `init` reports `the local source is unavailable` and cannot recreate it. When the project has a vendor tree, repair that tree instead, as described below.

## Installed content does not match rootform.lock

The Rootform home holds the version named by the lock, but its bytes no longer match the recorded digest. `init` does not overwrite an installed version. Delete the damaged copy with the family and `name@version` from the diagnostic, for example `rootform uninstall dialects payments@0.1.0` or `rootform uninstall policy-packs baseline@0.1.0`, then run `rootform init --locked --no-input` to install the pinned bytes again. The lock does not change. [External content storage](../reference/storage.md) explains where installed content lives.

## Vendored content is incomplete or altered

A locked run refuses a vendor family that no longer matches `rootform.lock` and exits `3`. While the family directory exists, Rootform does not fall back to a local source or registry. The text in parentheses names the problem:

```text title="Standard error examples"
rootform: SEMANTIC_SELECTION: the selected Dialects could not be loaded (selected dialect network-review differs from rootform.lock)
rootform: SEMANTIC_SELECTION: the selected Dialects could not be loaded (vendored dialect network-review is missing or invalid)
rootform: SEMANTIC_SELECTION: the selected Dialects could not be loaded (.rootform/dialects does not exactly match rootform.lock)
```

The first line means that a vendored Dialect's content changed. The second means that its vendor metadata is missing or unreadable. The third means that the family has a missing, extra, or unreadable entry; a `.rootform/dialects` path that is not a directory reports `is present but does not match rootform.lock` instead. Vendored Policy Packs are checked when a run selects their Policies, and report the same problems as `POLICY_UNAVAILABLE`, for example `selected Policy Pack baseline differs from rootform.lock`. Repair only the affected family from verified local or installed bytes:

<!-- docs-check:troubleshooting-vendor-repair -->
```sh
rootform vendor dialects --offline
```

`vendor` preserves the lock. If verified bytes are unavailable on this machine, prepare them in a connected environment and transfer the complete vendor family. [External content storage](../reference/storage.md) explains precedence.

## An offline add or update refuses a tag

A tag needs a registry lookup. With `--offline` or `ROOTFORM_OFFLINE=1`, `add` and `update` stop with status `2` and `"<reference>" is a tag, which cannot be resolved offline`. The hint names the setting that enabled offline mode: rerun without `--offline`, or unset `ROOTFORM_OFFLINE` when the environment set it. Offline, use a reviewed local source directory or an exact digest reference already installed on this machine instead. [Add external content](../guides/external-content.md) shows both forms.

## A Dialect owner collides with an embedded owner

An external Dialect named like an embedded one, such as `aws`, never replaces it by accident. `add` stops with `aws is an embedded Dialect; adding another aws replaces it` and suggests `--replace`. Rerun with `rootform add dialects <source> --replace` only when replacement is intended, after reviewing which embedded Rules the project loses. The reserved `rf` vocabulary cannot be replaced. See [Replace or exclude an embedded Dialect](../guides/external-content.md#replace-or-exclude-an-embedded-dialect).

## rootform.lock.new blocks a change

`add`, `remove`, `update`, and `vendor` prepare the new lock in `rootform.lock.new`. If one was interrupted, the next of these commands stops with `rootform.lock.new exists: another rootform add, remove, update, or vendor is running, or one was interrupted`. Analysis still reads the committed lock. Confirm that no Rootform command is running, delete the leftover file, then retry. If vendored content no longer matches the lock, repair the affected family with `rootform vendor`. [Who writes this file](../../contracts/rootform-lock.md#who-writes-this-file) lists every writer.

## Registry access or a private CA fails

Only explicit acquisition or publication crosses that boundary; normal `run` does not fetch packages. Check the exact OCI reference and digest in the lock, the registry host, `DOCKER_CONFIG`, credential-helper availability, and `SSL_CERT_FILE` for a private CA. Do not print credentials while diagnosing. An offline tag lookup cannot discover a new digest: use reviewed local source or an exact digest already installed, or perform selection while connected. [Registry compatibility](../integrations/registry-compatibility.md) and the [OCI mirror](../offline-security.md#oci-mirror) procedure give the details.

## A policy is unavailable or has no decision

Selecting a policy without any Policy Pack returns `POLICY_UNAVAILABLE: no Policy Pack is selected; pass --policy-pack or add one to rootform.lock`. Select a reviewed pack, then run again. A selected pack can still find no target: the summary says `Policies      no decision: the selected policies found nothing to evaluate`, and status `3` reports `POLICY_NO_DECISION: the selected policies evaluated no target`. Inspect the target with `rootform show policy <identifier>` and compare it with the document's interpreted Concepts and Rules. Zero evaluations are not compliance. [Target scope is exact](../concepts/policies.md#target-scope-is-exact) explains matching, and [Run checks](../guides/check-architecture.md) shows target coverage.

## A policy is indeterminate or violated

A violation exits `1`; an indeterminate outcome exits `3`. `report.md` and SARIF name each violated or indeterminate target. [Inspect the proof](../guides/check-architecture.md#inspect-the-proof) shows how `rootform explain policy` and `rootform explain architecture` trace each target to its facts and closures. Unknown, sensitive, and unverified absence cannot prove a negative assertion. Resolve input evidence or correct the Policy; do not remove a diagnostic to make the job pass. [Policy outcomes](../concepts/policies.md#evidence-produces-three-outcomes) explains the three results.

## A comparison appears empty or indeterminate

Check both selected stages and the comparison's `comparable`, `problems`, and `indeterminate` entries. A plan defaults to `planned`; a state JSON has only `recorded`. `run --diff` compares separate inputs and is not drift. Different Dialect selections, withheld external identity, or indeterminate closures may prevent a no-change claim. Use comparable stages and [read the comparison](../guides/compare-architectures.md). [Indeterminate preserves uncertainty](../concepts/comparisons.md#indeterminate-preserves-uncertainty) explains why an unsettled closure never counts as no change.

## A comparison input or saved document is refused

Each `--diff` operand must be accepted on its own. A refused operand stops the run with status `3`; Rootform never treats it as an empty side. The [refusals above](#malformed-or-unsupported-json-is-refused) apply to both inputs. A saved document written in another format is refused with `DOCUMENT_FORMAT_UNSUPPORTED: document format "9" is not supported; this build reads format 1`; save it again from its original input with the current binary. For any other rejected document, run `rootform validate document <document>`: it names each problem and exits `1`. `validate document` reads only Rootform documents; given a plan JSON, it exits `3` and suggests saving one first. [Valid partial document differs from invalid document](../concepts/forms.md#valid-partial-document-differs-from-invalid-document) separates missing knowledge from an invalid file.

## A port is occupied or the browser does not open

An occupied port returns status `4` and `SERVER_FAILED: port <number> is unavailable; pass --port 0 to pick a free port, or --no-serve`. Choose an available local port with `--no-browser --port 0`, then open the printed loopback address yourself. `--no-serve` skips the interface and writes requested files. A browser launch failure does not require rerunning analysis. Stop a foreground server with `Ctrl+C`. Rootform binds loopback only; use a self-contained HTML export for remote review instead of exposing the local server.

## An output path collides or cannot be written

If an output resolves to an input, `run` exits `2` with `rootform: output "plan.json" resolves to an input`. Choose a different path, including when a link points to the input. An unwritable target or server start failure exits `4`; already written files may remain after a later output fails. Check standard error, `run.status` in CI, and directory ownership. In a container, UID/GID `65532:65532` must be able to write the report mount; [container mounts](../integrations/oci-image.md#run-against-a-project) explain the split.

If the symptom remains, [report a synthetic reproduction](../contributing/index.md#report-a-semantic-gap) without credentials, raw plans, state, or private infrastructure.
