---
title: "Test and validate"
description: "Use formatting, compilation, fixtures, and policy evaluation to prove .rf source before packaging it."
---

Language authoring needs several checks because syntax validity alone cannot
prove semantic meaning. Use the smallest command that answers the current
question, then run the complete sequence before release.

| Command | Question answered |
| --- | --- |
| `rootform fmt --check` | Would formatting leave source unchanged? |
| `rootform validate dialects` | Do Dialect files compile with valid references and graph shape? |
| `rootform validate rule` | Is one selected rule valid in its Dialect? |
| `rootform test` | Do Dialect fixtures produce the reviewed Architecture IR bytes? |
| `rootform check` | What do selected policies decide over a real architecture? |
| `rootform package` | Can reviewed source become a deterministic distribution artifact? |

`validate` does not evaluate policies. `test` is for Dialect architecture
fixtures. `check` is for policy evaluation.

<!-- rootform:steps -->

## Format native and JSON source

Check formatting without modifying files:

```sh
rootform fmt --check .
```

Apply canonical formatting during authoring:

```sh
rootform fmt .
```

Rootform formats `.rf` with its native formatter and indents `.rf.json`
lexically. Formatting does not validate references or prove equivalence with a
different source file. Keep both forms only when both are intended source;
Rootform discovers both and neither overrides the other.

## Compile a Dialect source set

From a Dialect repository or isolated source root, compile every discovered
definition:

```sh
rootform validate dialects .
```

Successful validation proves accepted syntax, exact identities and versions,
reference scope, concept-kind constraints, rule and fact shapes, and a complete
canonical artifact. It does not prove that a provider field has the meaning you
assigned to it.

Use JSON when CI needs stable structured diagnostics:

```sh
rootform validate dialects . --format json
```

Diagnostics go to standard error. Exit status `0` means valid, `1` means at
least one definition is invalid, `2` means incorrect command use, and `3` means
validation could not decide a result.

Validation above reads the source set directly. For commands that inspect
objects or build fixtures, install the checkout into an isolated authoring
home first:

```sh
export ROOTFORM_HOME="$(mktemp -d)"
rootform install dialects .
rootform verify dialects .
```

Then inspect one object from the selected or installed semantics:

```sh
rootform validate rule aws/subnet
rootform show rule aws/subnet
rootform validate concept core/subnet
```

Qualification removes ambiguity. A bare object name is accepted only when it
resolves to one selected object.

## Compare a Dialect fixture

Create small source cases around observable architectural consequences. A case
qualifies when one directory contains Terraform/OpenTofu `.tf` source and an
`architecture.golden` file:

```text title="Fixture suite"
fixtures/
└── example/
    ├── minimal/
    │   ├── main.tf
    │   └── architecture.golden
    └── boundary/
        ├── main.tf
        └── architecture.golden
```

Before first comparison, complete isolated authoring setup from
[Write a Dialect](../dialect-authoring.md#set-up-an-authoring-checkout): install
checkout's Dialects into temporary `ROOTFORM_HOME`, then review candidate
Architecture IR before saving it as `architecture.golden`. Repository fixture
suite supplies exact shared semantics; `rootform test` never updates golden.

Run the suite with its prepared lock and semantics:

```sh
rootform test ./fixtures
```

Narrow by case-name substring while iterating:

```sh
rootform test ./fixtures --run example/minimal
```

Rootform builds every selected case and compares exact output bytes with the
reviewed golden. A difference reports the first byte position and a bounded
window; it does not dump the architecture.

Review a changed golden as product behavior. Check at least:

- representation IDs and concepts;
- context, contribution, and relation facts;
- composition membership;
- source declaration outcomes;
- provenance and diagnostics;
- absence of raw sensitive values;
- byte-identical repeat output.

Positive fixtures prove intended meaning. Boundary fixtures prove where a rule
must not match or where evidence must remain unresolved.

## Evaluate policies over known facts

Prepare an architecture project first, then compile and evaluate a local pack:

```sh
rootform check ./example --policy-pack ./policies
```

Use structured output to assert selection and coverage, not only process exit:

```sh
rootform check ./example \
  --policy-pack ./policies \
  --format json \
  --output policy-result.json
```

A useful policy test matrix includes:

| Case | Expected evidence |
| --- | --- |
| Passing target | Known true assertion and expected inspected fact IDs. |
| Violating target | Known false assertion, expected message, target, and exit status `1`. |
| Missing target | Zero evaluations, recorded as an explicit coverage case. |
| Incomplete or incompatible architecture | Indeterminate result and exit status `3`. |
| Unknown required vocabulary | Compile or evaluation diagnostic, never a guessed decision. |

Do not edit generated Architecture IR to create a passing case. Change source,
Dialect, or policy input, then rebuild the evidence.

## Inspect diagnostic ranges

Keep the stable code and source range in failure assertions. Messages help
people, but codes are the better automation boundary:

```text title="Example assertion"
code: CONCEPT_UNKNOWN
path: network/rules.rf
line: 18
column: 10
```

Paths are sanitized and relative to the source root. Native parser failures are
reported as `HCL_PARSE`; Rootform shape and semantic failures use more specific
codes. See [Diagnostics](reference/diagnostics.md) for remediation groups.

## Verify the package boundary

After source and behavior pass, package locally. Replace example URLs with
repository-owned values; use exact revision from checkout:

```sh
rootform package dialects . --to ./artifacts/dialects \
  --repository registry.example/team/dialects \
  --source-url https://example.com/team/dialects \
  --revision "$(git rev-parse HEAD)" \
  --licenses MPL-2.0
```

For a Policy Pack:

```sh
rootform package policy-packs ./policies --to ./artifacts/policies \
  --source-url https://example.com/team/policies \
  --revision "$(git rev-parse HEAD)" \
  --licenses Apache-2.0
```

Package commands are offline. Verify a Dialect layout with
`rootform verify dialects`. Policy Pack release automation should repull the
published tag and digest before reporting success.

<!-- rootform:endsteps -->
