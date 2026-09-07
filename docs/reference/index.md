---
title: "Reference"
description: "Find exact CLI syntax, output formats, public contracts, and exit status."
---

Use reference pages when you know the task and need an exact command or
contract. Start with the [first architecture](../getting-started/first-architecture.md)
if you want a guided run.

## Commands

[CLI lifecycle](../cli.md) describes project preparation and the Dialect and
Policy Pack command families. [rootform build](cli/build.md) is the detailed
command reference, with flags, defaults, examples, and exit status.

For every command in your installed version:

```sh
rootform --help
rootform build --help
```

The built-in help comes from the actual command tree. Consult it when an
installed version differs from the documentation.

## Data contracts

[Outputs and exit status](outputs.md) maps each result to its consumer.
The [public contracts](../../contracts/README.md) and
[schemas](../../schemas/architecture-ir.schema.json) define machine-facing
formats. A visual example does not override a contract.
