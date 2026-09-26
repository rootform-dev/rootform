---
title: "Outputs and exit status"
description: "Choose a Rootform document or report and interpret one run status."
---

`rootform run` analyzes a plan or state, opens a saved document, or compares two inputs. By default it serves a loopback browser view. `--no-serve` writes files and exits. Each `-o` file selects its format by extension: `.json` is the format-1 Rootform document, `.md` is Markdown, `.txt` is text, `.sarif` is SARIF 2.1.0, and `.html` is a standalone browser report. All outputs come from the same analysis.

The JSON document is reusable as a `run` input. A plan document can contain stages, internal comparisons, and a drift report. A cross-input comparison has `kind: "comparison"`. SARIF contains diagnostics and explicitly evaluated policy results; no selected policies is recorded as no decision, not compliance.

| Exit | Meaning |
| --- | --- |
| `0` | Analysis succeeded and every selected policy passed. |
| `1` | A selected policy was violated. |
| `2` | Incorrect command use. |
| `3` | Input refused, or a selected policy was indeterminate or decided nothing. |
| `4` | Output could not be written or server could not start. |

The summary goes to standard output when no file is written. Progress, warnings, server address, and failures go to standard error. Do not merge stderr into machine-readable output. A successful comparison may include changes or undetermined entries; inspect the document rather than interpreting status alone as a no-change claim.

Producer plan and state exports can contain cleartext sensitive values. Rootform output masks them, but external identity disclosure follows Dialect declarations. Review an artifact before sharing. See [Limitations](../limitations.md) and the [document contract](../../contracts/architecture-ir.md).
