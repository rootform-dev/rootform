---
title: "Compare two architectures"
description: "Add a subnet, compare before and after facts, and verify Diff exit behavior."
---

Add a database subnet to the [first architecture](../getting-started/first-architecture.md)
and compare the result. Use that tutorial directory and the same Rootform
binary for both builds.

## Save the base

<!-- docs-check:diff-base -->
```sh
rootform build . --output before.json
```

Keep `before.json` as the before-side evidence. Do not rebuild over it after
editing source.

## Add a subnet

Create a second source file beside `main.tf`:

```hcl title="database.tf"
resource "aws_subnet" "database" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.2.0/24"
}
```

Build the head with the same supplied release set:

<!-- docs-check:diff-head -->
```sh
rootform build . --output after.json
```

The build now accounts for four declarations: three resources and one
Terraform settings declaration. Every resource has a base representation. The
AWS Dialect applies a Rule to each resource, so Rule coverage is also three in
this example.

## Read the difference

<!-- docs-check:diff-text -->
```sh
rootform diff before.json after.json
```

Observed output:

```text title="Diff output"
+ context "rf.context.network" from representation:1:root:resource:aws_subnet.database to representation:1:root:resource:aws_vpc.main
+ rf.concept.subnet "database"
```

The two additions are architectural results: a representation classified as
`rf.concept.subnet` and its network context. Both came from one new source
resource. Diff reports architectural meaning, not a list of Terraform edits.

The command exits `0` even though changes exist. Request a difference status
when a change must gate automation:

<!-- docs-check:diff-exit -->
```sh
rootform diff before.json after.json --exit-code
```

Expect the same text and exit status `1`. For an identical pair:

<!-- docs-check:diff-identical -->
```sh
rootform diff before.json before.json --exit-code
```

Expect `no architectural change` and status `0`.

## Save a report

<!-- docs-check:diff-json -->
```sh
rootform diff before.json after.json --format json --output delta.json
```

The JSON summary has one added representation and one added context, with no
undetermined entries. `--format markdown` writes a review-oriented report.

For a pull request, build `before.json` from the target revision and
`after.json` from the proposed revision with the same Rootform binary and the
same external selection, when the project has one. Attach Markdown for human
review or JSON for automation. Use `--exit-code` when any change or
undetermined result must block the job.

[Architecture Diff](../concepts/diff.md) explains continuity, fact changes,
semantic mismatches, and undetermined results. Use
[plan Diff](../inputs/plans.md#compare-both-sides-of-one-plan) when one plan
supplies both sides. The [command reference](../reference/cli/diff.md) defines
directory inputs, standard input, formats, and flags.
