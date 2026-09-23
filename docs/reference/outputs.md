---
title: "Outputs and exit status"
description: "Choose an architecture, policy, or comparison result and interpret its status."
---

An output file's presence, extension, or valid JSON syntax does not prove the
operation succeeded. Check the command's exit status and read its diagnostics.

| Result | Command and format | Use |
| --- | --- | --- |
| Architecture JSON | `build` (default `json`) | Reusable architecture document for `run`, `check`, `diff`, and `explain architecture`. |
| Architecture HTML | `build --format html` | Self-contained browser view of one architecture, not an interactive Diff report. |
| Policy report | `check` (`text`, `json`, `markdown`, `sarif`) | Human review, machine processing, Markdown review, or SARIF consumer. |
| Comparison report | `diff` (`text`, `json`, `markdown`) | Human review or processing of determined and undetermined architectural changes. |

Architecture JSON is a reusable input. Policy and Diff reports are results of
evaluation or comparison, not architecture inputs. HTML represents an
architecture in a browser; it does not turn a Diff into an interactive view.

## Interpret check and diff status

| Status | `check` | `diff` |
| --- | --- | --- |
| `0` | Every selected policy was evaluated and passed. | Comparison completed. Changes or undetermined facts may still be present without `--exit-code`. |
| `1` | At least one confirmed violation, including a mixed result. | With `--exit-code`, changes or undetermined facts were reported. |
| `2` | Command used incorrectly. | Command used incorrectly. |
| `3` | No compliant verdict: indeterminate or not evaluated, with no confirmed violation. | Comparison could not be completed. |

Zero selected policies, zero evaluations, or a selected policy without targets
cannot establish compliance. An undetermined fact in a completed Diff is not
status `3`. Inspect the report even when Diff exits `0`. These codes are not a
universal contract for other commands; use the relevant [CLI reference](cli/index.md).

## Keep results and diagnostics separate

`build` writes architecture JSON or HTML to standard output by default, or to
`--output`. Its preparation messages, declaration summary, and diagnostics go
to standard error. `check` and `diff` write their selected report format to
standard output or `--output`, with operational diagnostics on standard error.
For a text `check`, the policy summary and detail are part of the report on
standard output. Do not merge standard error into machine-readable output.

Structured reports can also contain diagnostics. Preserve both the report and
standard error when investigating a failure. For artifact collection that
keeps the actual exit status and only current-run results, see
[Run in CI](../integrations/ci/README.md).

Architecture files retain names, addresses, source locations, and semantic
relationships. Review them before sharing; see [security guidance](../security/index.md)
and [public contracts](../../contracts/README.md) for fields and disclosure boundaries.
