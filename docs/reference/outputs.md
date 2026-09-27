---
title: Outputs and exit status
description: Choose analysis and Policy output formats and interpret each command's exit status.
---

`rootform run` analyzes inputs and produces a Form. `rootform check`
evaluates selected Policies against a plan, state, or saved Form and produces
separate Policy results. A written file alone does not prove success: check
the relevant exit status and standard error. A comparison can contain changes
or indeterminate entries while analysis returns `0`.

## Keep standard output and errors separate

Without `--format`, standard output carries the human summary. For `run`,
it includes stage, instance, fact, closure, drift, and diagnostic counts as
available. For `check`, it reports the Policy verdict and target counts.
Standard error carries progress, warnings, the loopback server address for
`run`, and failures. Do not merge it into machine-readable standard output.

With no `-o` file, `--format` selects the standard output format.
`run` supports JSON, text, Markdown, and HTML; `check` supports text,
JSON, Markdown, and SARIF. `--no-serve` writes files and exits; the normal
`run` mode serves the result in the foreground. `check` never serves.
`--no-browser` changes browser launch, not the server or output.

## Choose an output file

Repeat `-o` to write several views:

| Extension | Command | Content and use |
| --- | --- | --- |
| `.json` | `run` | Form. Reopen with `run`, inspect stages and evidence, or process as data. |
| `.md` | `run` | Markdown report for human review. |
| `.txt` | `run` | Plain-text report for terminal-oriented review. |
| `.html` | `run` | Self-contained interactive Explorer for browser review without a server. |
| `.json` | `check` | Structured Policy result. |
| `.md`, `.txt` | `check` | Policy report for human review. |
| `.sarif`, `.sarif.json` | `check` | SARIF 2.1.0 Policy result; keep as a build artifact. |

The JSON Form is reusable input. Plan Forms can contain stages, internal
comparisons, and a drift report; cross-input results have
`kind: "comparison"`. `check` loads a saved Form without recompiling it.
Reports and HTML exports are outputs, not analysis inputs. For `run`,
`--format` also sets the format of one `-o` target whose extension is not
recognized; it cannot contradict a recognized extension. `check` requires one
of its extensions on every `-o` target, and its `--format` applies only to
standard output.

<!-- docs-check:journey-outputs-multiple -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve \
  -o analysis.json -o architecture.md -o architecture.html
```

All requested formats render before the first file is written. A duplicate
target, a format-extension conflict, or an output path that resolves to an
input, including through a link, is a usage error (`2`). Files are written
through temporary files in their target directories, then renamed into
place individually. If a later write fails, earlier successful files remain
and the failed target is reported; exit status is `4`.

## Analysis exit status

| Exit | Exact condition |
| --- | --- |
| `0` | Analysis completed. |
| `2` | Incorrect command use, such as an invalid flag combination or output collision. |
| `3` | Input or analysis failed. |
| `4` | An output could not be written, or the local server could not start. |

A difference, an indeterminate comparison entry, or reported drift is not an
analysis failure by itself.

## Policy check exit status

| Exit | Exact condition |
| --- | --- |
| `0` | Every selected Policy evaluated and passed. |
| `1` | A selected Policy was violated. |
| `2` | Incorrect command use, such as an invalid option value, an unknown or ambiguous `--policy` selector, `--side` on a Form that is not a comparison, or `--stage recorded` on a plan. |
| `3` | No verdict: an indeterminate result, a selected Policy with no target, nothing selected, an unavailable stage, no selected Policy Pack, or a failed input or evaluation. |
| `4` | A report could not be written after the verdict was stated. |

Reports are written for every verdict. No selected Policies means no
compliance claim. For Policy coverage and results, see
[Check an architecture](../guides/check-architecture.md).

## Interpret SARIF

SARIF from `check` contains explicitly evaluated Policy results. A Policy
rule ID is `<pack>/<policy>`. A pass uses `kind: pass` and `level: none`,
a confirmed violation uses `kind: fail` and `level: error`, and an
indeterminate evaluation uses `kind: review` and `level: none`. Result
properties name the evaluated stage. A policy execution failure appears under
`toolExecutionNotifications`.

Each Policy result names its instance address as a logical location and its
stage in the result properties; SARIF from Rootform has no file locations.
Ingestion by a code-scanning service is not tested. Keep the SARIF log as an
artifact. The report carries no attribute values, secrets, or configuration
text. It still exposes instance addresses and Policy outcomes; apply your
sharing rules before uploading it.

## Use the HTML export

`.html` embeds the Explorer and a display copy of the Form in one file.
It opens from disk, makes no network requests, and needs no server or
neighboring files. The display copy keeps only the Dialect definitions the
analysis uses and leaves out external identities that a Dialect records for
the JSON Form only; it cannot be reopened as an input. The local server
binds `127.0.0.1` and serves the same display copy, never the plan or state
files. The reusable `.json` Form keeps the complete data; review both
before sharing. See [security guidance](../security/index.md) and the
[Form contract](../../contracts/form.md).

## Expect deterministic results

Given the same accepted inputs, selected Dialects, operator claims, and
Rootform binary, the Form and reports are deterministic. The plan
or state export's completeness and uncertainty remain visible; a partial or
targeted plan cannot become a proof of absence through output formatting.
