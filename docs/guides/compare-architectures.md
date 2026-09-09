---
title: "Compare two architectures"
description: "Add a subnet, compare before and after facts, and verify Diff exit behavior."
---

Add a database subnet to the [first architecture](../getting-started/first-architecture.md)
and compare the result. Use that tutorial directory with its prepared Dialects.

## Save the base

<!-- docs-check:diff-base -->
```sh
rootform build . --locked --offline --no-input --output before.json
```

Keep this file as the before-side evidence. Do not rebuild over it after editing
source.

## Add a subnet

Create a second source file beside `main.tf`:

```hcl title="database.tf"
resource "aws_subnet" "database" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.2.0/24"
}
```

Build the head with the same lock:

<!-- docs-check:diff-head -->
```sh
rootform build . --locked --offline --no-input --output after.json
```

The build now accounts for four declarations: three represented and one filtered
Terraform settings block. There are no unsupported or failed declarations.

## Read the difference

<!-- docs-check:diff-text -->
```sh
rootform diff before.json after.json
```

Observed output:

```text title="Diff output"
+ context "core/network" from scope:aws_subnet.database to scope:aws_vpc.main
+ core/subnet "database"
```

The two additions are architectural facts: the subnet and its network context.
They are not two Terraform resource additions. Both came from the single new
subnet declaration.

The command exits `0` even though changes exist. To request a difference status:

<!-- docs-check:diff-exit -->
```sh
rootform diff before.json after.json --exit-code
```

Expect the same text and exit status `1`. For an identical input pair:

<!-- docs-check:diff-identical -->
```sh
rootform diff before.json before.json --exit-code
```

Expect `no architectural change` and status `0`.

Explore a predefined migration in the
[Diff Playground](https://docs.rootform.dev/playground/?mode=diff&scenario=analytics-migration)
to see how the Diff view connects additions, removals, moves, and relation changes to
evidence. This sample is separate from the comparison you just created.

## Save the report and inspect either side

<!-- docs-check:diff-json -->
```sh
rootform diff before.json after.json --format json --output delta.json
```

The JSON summary has one added representation and one added context, with no
undetermined entries. `--format markdown` writes a review-oriented report.
These reports do not start a browser. You can inspect either architecture
separately:

```sh
rootform run after.json
```

For a pull request, build `before.json` from the target revision and `after.json`
from the proposed revision with the same lock. Attach Markdown for reviewers or
JSON for automation, and use `--exit-code` when any change or undetermined fact
must block the job. [Git and team workflows](../workflows/index.md) covers that
handoff.

The [Diff explanation](../renderer/diff.md) covers added, removed, changed,
moved, and undetermined results in the Diff view. Use
[plan Diff](../inputs/plans.md#compare-both-sides-of-one-plan) when one plan supplies
both sides. The [command reference](../reference/cli/diff.md) covers directory
inputs, standard input, formats, and flags.
