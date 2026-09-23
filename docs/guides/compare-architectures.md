---
title: "Compare architectures"
description: "Add a subnet, compare before and after architecture, and save reports for review or automation."
---

Continue from a fresh copy of [Your first architecture](../getting-started/first-architecture.md).
The directory must contain its original `main.tf` and no `database.tf` or other
additional Terraform files. If you already changed that tutorial directory,
start from a new copy so existing files do not alter the results below.

Use the same Rootform binary and effective Dialect selection for both builds.
This isolates architecture changes caused by the source edit.

## Save the initial architecture

Build the initial VPC and application subnet before changing source:

<!-- docs-check:diff-base -->
```sh
rootform build . --output before.json
```

Keep `before.json` unchanged. It records the architecture before the edit.

## Add the database subnet

Create this complete file beside `main.tf`:

```hcl title="database.tf"
resource "aws_subnet" "database" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.2.0/24"
}
```

Build again with the same binary and Dialect selection:

<!-- docs-check:diff-head -->
```sh
rootform build . --output after.json
```

`after.json` contains the VPC and both subnets. This second build leaves
`before.json` unchanged.

## Read the changes

<!-- docs-check:diff-text -->
```sh
rootform diff before.json after.json
```

```text title="Diff output"
Architecture changed

Resources  +1
Contexts   +1

Resources
  + aws_subnet.database
      as rf.concept.subnet "database"

Contexts
  + aws_subnet.database  rf.context.network  aws_vpc.main

```

One Terraform resource produced two architectural results. The added
Representation identifies `aws_subnet.database` as a subnet. The added Context
places it in `aws_vpc.main`. These entries do not mean Terraform created two
resources, and Architecture Diff is not a list of Terraform actions.

A successful comparison does not mean no change. Without `--exit-code`, this
completed comparison returns status `0` even though its report contains
changes.

## Use exit status deliberately

Request a nonzero status when any determined or undetermined result must stop
automation:

<!-- docs-check:diff-exit -->
```sh
rootform diff before.json after.json --exit-code
```

The command prints the same report and returns status `1`. An identical pair
returns status `0`:

<!-- docs-check:diff-identical -->
```sh
rootform diff before.json before.json --exit-code
```

```text title="Identical Diff output"
Architecture unchanged
```

An `undetermined` entry means available evidence cannot prove whether an
architectural fact changed. It is not a proven removal and does not by itself
mean the comparison failed. [Architecture Diff](../concepts/diff.md#undetermined-preserves-uncertainty)
explains the complete evidence model.

## Save reports

Use JSON when automation needs structured changes and summary counts:

<!-- docs-check:diff-json -->
```sh
rootform diff before.json after.json --format json --output delta.json
```

This example contains one added Representation, one added Context, and no
undetermined entries. Use Markdown for a human review:

<!-- docs-check:diff-markdown -->
```sh
rootform diff before.json after.json --format markdown --output architecture-diff.md
```

Rootform exposes Diff reports as text, JSON, and Markdown. It has no CLI entry
point or HTML format for an interactive Diff. `rootform build --format html`
exports one architecture, not an interactive comparison.

Continue with [Review a pull request](../workflows/index.md) for isolated Git
revisions, report placement, and cleanup. Use
[plan Diff](../inputs/plans.md#compare-both-sides-of-one-plan) when one plan
supplies both sides. The [`rootform diff` reference](../reference/cli/diff.md)
defines every accepted input, format, and status.
