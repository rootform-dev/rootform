---
title: "Outputs and exit status"
description: "Choose architecture, HTML, policy, SARIF, and Diff outputs without confusing process success with a governance claim."
---

Choose an output for its consumer, then use the command's exit contract to
interpret the result. A file extension alone is not evidence of success.

| Output | Produced by | Use |
| --- | --- | --- |
| Architecture JSON | `build` | Reuse semantic evidence with `run`, `check`, `diff`, or `explain`. Consumers validate the document before using it. |
| Self-contained HTML | `build --format html` | Open or share an interactive architecture file. |
| Policy result | `check --format json` | Inspect selected policies, evaluations, violations, and indeterminate outcomes. |
| SARIF | `check --format sarif` | Present those same policy findings in a compatible code-scanning consumer. |
| Architecture Diff | `diff --format json` | Consume determined and undetermined comparison facts. |
| Policy text report | `check` | Read policy outcomes in a terminal. |
| Diff text or Markdown report | `diff` | Read changes in a terminal or code review. |

## Status is command-specific

| Status | `check` | `diff` |
| --- | --- | --- |
| `0` | Evaluation completed without a violation or indeterminate result. Check the number of policies and evaluations. Both can be zero. | Comparison completed. Differences and undetermined facts still return `0` unless `--exit-code` is set. |
| `1` | At least one policy violation, with no indeterminate outcome taking precedence. | With `--exit-code`, the comparison contains changes or undetermined facts. |
| `2` | Invalid command use. | Invalid command use. |
| `3` | Evaluation is indeterminate or required evidence is unavailable. | Comparison could not be completed, for example because an input is invalid or incompatible. |

An undetermined Diff fact is not itself status `3`. It can occur in a valid
report, including one with no determined changes. Read the report rather than
treating a successful process as proof of no change.

Other commands define their own status `1` cases, including failed lookups.
Each [command reference](cli/index.md) includes its actual exit contract.

## Keep machine output separate

JSON and SARIF go to standard output or the file named by `--output`.
Progress and operational warnings use standard error. Structured diagnostics
also belong to their result document; do not discard them because the command
produced valid JSON.

Text output includes more human context. For a directory build, declaration
accounting goes to standard error. A text `check` prints its policy summary
and declaration accounting on standard output.

Use `--format json` for a parser and preserve standard error separately.
Merging streams with `2>&1` can turn valid JSON into unreadable input.

## Share the right artifact

HTML carries its renderer and assets, so its recipient needs only a browser.
Architecture JSON is smaller and works as input to another Rootform command.
Neither is a replacement for the Terraform or OpenTofu source.

Architecture files retain names, addresses, source locations and semantic
relationships. Review them before sharing. See the
[public contracts](../../contracts/README.md) for exact fields and
[security guidance](../security/index.md) for the disclosure boundary.
