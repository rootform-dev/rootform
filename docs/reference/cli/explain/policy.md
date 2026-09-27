---
title: "rootform explain policy"
description: "Explain one Policy outcome recorded by check."
---

Pass a Policy name and the JSON Policy result written by `rootform check` as
`--result`. The explanation reports why the Policy passed, was violated,
remained indeterminate, or had no target: the Requirement the Policy declares,
with its assertion and target, then each evaluation's recorded evidence and
conclusion. Nothing is evaluated again. Name the Policy by the identity `list`
and `show` print, `<pack>.policy.<name>`, or as `PACK/NAME` or an
unambiguous bare name.
For a comparison result, `--side before` or `--side after` selects one recorded
side; the default covers every recorded side.

Optional `--input` reads the Form as `run` does and describes the evidence
inspected by the recorded evaluation. Its Form digest must match the digest
in the Policy result. Omit `--input` to inspect the recorded outcome alone;
the explanation then says which evidence the result cannot describe and how to
pass the Form. A Form with a different digest is refused.

<!-- BEGIN GENERATED CLI: rootform explain policy -->

## Usage

```text
rootform explain policy <policy> --result <file> [options]
```

## Options

### Inputs

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --input ` | ` string ` | ` "" ` | describe inspected evidence from the Form `input` the result was computed from: a plan JSON, a state JSON, a saved Form, or `-` |
| ` --result ` | ` string ` | ` "" ` | read the Policy result `file` that check wrote as JSON, or `-` for standard input |
| ` --side ` | ` string ` | ` "" ` | side of a comparison result to explain: `before\|after`; default: every recorded side |

### Output

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --details ` | ` bool ` | ` false ` | also list passed evaluations and diagnostic codes, and list every entry |
| ` --format ` | ` string ` | ` "" ` | output format: `text\|json`; default: text |

### Rootform project

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --dialect ` | ` stringArray ` | ` [] ` | use Dialect source `dir` for this command only; repeatable |
| ` --locked ` | ` bool ` | ` false ` | refuse to run unless rootform.lock is valid |
| ` --project ` | ` string ` | ` "" ` | read rootform.lock from project `dir`; paths stay relative to the working directory; default: the working directory |

### Advanced evidence settings

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` --plan-complete ` | ` string ` | ` "" ` | declare the plan complete; the only `value` is attested |
| ` --plan-file ` | ` string ` | ` "" ` | pair the plan JSON with the saved plan `file` it was exported from, to enrich it; pairing compares version, timestamp, and configuration shape |
| ` --producer ` | ` string ` | ` "" ` | declare the tool that produced the input: `terraform\|opentofu` |
| ` --provider-map ` | ` stringArray ` | ` [] ` | map an observed provider to a binding, as `observed=binding`; repeatable |
| ` --require-enrichment ` | ` bool ` | ` false ` | refuse the input when its saved plan file does not pair with the plan JSON |

### Global options

| Flag | Type | Default | Meaning |
| --- | --- | --- | --- |
| ` -h, --help ` | ` bool ` | ` false ` | show how to use rootform explain policy |
| ` --color ` | ` mode ` | ` auto ` | color human output: `auto\|always\|never`; default: auto |

<!-- END GENERATED CLI -->

From the commerce plan, save a Form, check it, and explain one recorded
Policy outcome:

<!-- docs-check:cli-explain-policy -->
```sh
rootform run examples/playground/commerce-platform/head/plan.json \
  --plan-file examples/playground/commerce-platform/head/plan.tfplan \
  --no-serve -o analysis.json
rootform check analysis.json --policy-pack policy-packs/baseline \
  -o results.json --color always
rootform explain policy baseline.policy.cluster-network-context \
  --result results.json --input analysis.json --color always
```

<!-- docs-output:cli-explain-policy -->
```ansi title="Recorded Policy outcome, excerpt"
[1mPolicy explained[0m
[2mPolicy[0m         baseline.policy.cluster-network-context
[2mResult[0m         results.json
[2mInput[0m          analysis.json
[2mEvaluations[0m    1
[2mPassed[0m         1
[2mOutcome[0m        [1m[32mPASSED[0m
[1m[38;5;208mRequirement[0m
  Kubernetes clusters must belong to a network context.
  [2mAssertion[0m  exists(contexts(rf.context.network, rf.concept.virtual-network))
             || exists(contexts(rf.context.network, rf.concept.subnet))
  [2mTarget[0m     Concept rf.concept.kubernetes-cluster
The evaluation passed.
```

The explanation goes to standard output, while progress and errors go to
standard error. Status `0` means the Policy outcome was explained; `1` means
the result records no Policy with that name; `2` means incorrect usage; `3`
means the result or input was refused, the name is ambiguous, the side is not
recorded, the check recorded no outcome for this Policy, or the input is not
the Form the result was computed from; `4` means the result or input file
could not be read. To inspect the definition, use
[`show policy`](../show/policy.md). For evaluation, see the
[`check` CLI reference](../check.md).
