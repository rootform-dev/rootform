---
title: "Outputs and exit status"
description: "Choose architecture, HTML, policy, SARIF, and Diff outputs without confusing process success with a governance claim."
---

Choose an output for its consumer, then use the command's exit contract to
interpret the result. A file extension alone is not evidence of success.

| Output | Produced by | Use |
| --- | --- | --- |
| Architecture JSON | `build` | Reuse validated semantic evidence with `run`, `check`, `diff`, or `explain`. |
| Self-contained HTML | `build --format html` | Open or share an interactive architecture file. |
| Policy result | `check --format json` | Inspect selected policies, evaluations, violations, and indeterminate outcomes. |
| SARIF | `check --format sarif` | Present those same policy findings in a compatible code-scanning consumer. |
| Architecture Diff | `diff --format json` | Consume determined and undetermined comparison facts. |
| Human-readable report | `check` or `diff` | Read text or Markdown in a terminal or review. |

## Status is command-specific

Status `0` means the requested command succeeded; it does not establish every
possible architectural or policy claim. `diff` returns `0` on differences
unless `--exit-code` was supplied. A check with no selected policies is not a
security audit.

Status `1` reports a command-defined finding, difference, or missing lookup.
Status `2` is incorrect command use. Status `3` means Rootform could not reach
the requested decision. Consult each command's `--help` before turning those
statuses into CI rules.

Machine output stays on standard output or the selected file; progress and
diagnostics use standard error. Preserve both streams without merging diagnostic
text into JSON. Read the [public contracts](../../contracts/README.md) for
exact fields and [security guidance](../security/index.md) before sharing results.
