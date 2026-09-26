---
title: Outputs and exit status
description: Choose output formats and interpret streams, file writes, SARIF, and one run status.
---

`rootform run` produces one analysis result for its terminal summary, files,
and optional local Explorer. A written file alone does not prove success:
check the exit status and standard error. A comparison can contain changes
or indeterminate entries while returning `0`.

## Keep standard output and errors separate

Without `--format`, standard output carries the human summary, including
stage, instance, fact, closure, drift, policy, and diagnostic counts as
available. Standard error carries progress, warnings, the loopback server
address, and failures. Do not merge it into machine-readable standard output.

With no `-o` file, `--format json`, `text`, `markdown`, or `sarif`
selects the standard output format. `--no-serve` writes files and exits;
the normal mode serves the result in the foreground. `--no-browser`
changes browser launch, not the server or output.

## Choose an output file

Repeat `-o` to write several formats from the same analysis:

| Extension | Content | Use |
| --- | --- | --- |
| `.json` | Rootform document | Reopen with `run`, inspect stages and evidence, or process as data |
| `.md` | Markdown report | Human review in a repository or CI artifact |
| `.txt` | Plain-text report | Terminal-oriented review |
| `.sarif`, `.sarif.json` | SARIF 2.1.0 | A SARIF consumer |
| `.html` | Self-contained interactive Explorer | Browser review without a server |

The JSON document is reusable input. Plan documents can contain stages,
internal comparisons, and a drift report; cross-input results have
`kind: "comparison"`. Reports and HTML exports are outputs, not analysis
inputs. `--format` also sets the format of one `-o` target whose extension
is not recognized. It cannot contradict a recognized extension.

<!-- docs-check:journey-outputs-multiple -->
```sh
rootform run plan.json --plan-file plan.tfplan --no-serve \
  -o analysis.json -o architecture.md -o architecture.sarif.json -o architecture.html
```

All requested formats render before the first file is written. A duplicate
target, a format-extension conflict, or an output path that resolves to an
input, including through a link, is a usage error (`2`). Files are written
through temporary files in their target directories, then renamed into
place individually. If a later write fails, earlier successful files remain
and the failed target is reported; exit status is `4`.

## Exit status

| Exit | Exact condition |
| --- | --- |
| `0` | Analysis completed; if policies were selected, every evaluation passed. |
| `1` | A selected policy produced a confirmed violation, including a mixed result. |
| `2` | Incorrect command use, such as an invalid flag combination or output collision. |
| `3` | Input refused; or selected policies were indeterminate or decided nothing without a confirmed violation. |
| `4` | An output could not be written or the server could not start. |

No selected policies means no compliance claim, even though successful
analysis exits `0`. A difference, an indeterminate comparison entry, or
reported drift is not a command failure by itself. For policy coverage and
results, see [Run policy checks](../guides/check-architecture.md).

## Interpret SARIF

SARIF includes document diagnostics and explicitly evaluated Policy
results. A Policy rule ID is `<pack>/<policy>`; diagnostic codes are
also stable rule IDs. A pass uses `kind: pass`, a confirmed violation
uses `kind: fail` and `level: error`, and an indeterminate evaluation
uses `kind: review` and `level: warning`. Result properties name the
evaluated stage. A policy execution failure appears under
`toolExecutionNotifications`. If no policies ran, the invocation records
`policies_evaluated: 0` and contains no invented pass result. SARIF
selection never changes evaluation or exit status.

Each Policy result names its instance address as a logical location and its
stage in the result properties; SARIF from Rootform has no file locations.
The report carries no attribute values, secrets, or configuration text. It
still exposes instance addresses and policy outcomes; apply your sharing
rules before uploading it.

## Use the HTML export

`.html` embeds the Explorer and a display copy of the document in one file.
It opens from disk, makes no network requests, and needs no server or
neighboring files. The display copy keeps only the Dialect definitions the
analysis uses and leaves out external identities that a Dialect records for
the JSON document only; it cannot be reopened as an input. The local server
binds `127.0.0.1` and serves the same display copy, never the plan or state
files. The reusable `.json` document keeps the complete data; review both
before sharing. See [security guidance](../security/index.md) and the
[document contract](../../contracts/rootform-document.md).

## Expect deterministic results

Given the same accepted inputs, selected Dialects, operator claims, and
Rootform binary, the document and reports are deterministic. The plan
or state export's completeness and uncertainty remain visible; a partial or
targeted plan cannot become a proof of absence through output formatting.
