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
available. For `check`, it reports evaluation counts and the verdict, per side
for a comparison Form.
Standard error carries progress, warnings, the loopback server address for
`run`, and failures. Do not merge it into machine-readable standard output.

Without an `-o` file, `--format` selects the standard output format.
`run` supports JSON, text, Markdown, and HTML; `check` supports text,
JSON, Markdown, and SARIF. `--no-serve` writes files and exits; the normal
`run` mode serves the result in the foreground. `check` never serves.
`--no-browser` changes browser launch, not the server or output.

## Read long reports

On an interactive terminal, a long text report or help opens in `less` once
every requested file is written. Enter advances one line, Space one page, `b`
goes back a page, and `q` quits; quitting never changes the exit status. With
`--no-pager`, a pipe or a file, a CI run, `TERM=dumb`, or no `less`
installed, Rootform prints the whole report without waiting. `ROOTFORM_PAGER`
names another pager, or disables paging when set to an empty value. The
summary printed beside the explorer and JSON, SARIF, Markdown, and HTML output
never open a pager.

Text reports list every entry at the chosen depth: every change of a
comparison, every violated or indeterminate evaluation with all its evidence,
and every row of an explanation. `--details` adds depth, such as semantics,
diagnostic codes, and passed evaluations. The summary beside the explorer
previews each group instead and states how many entries it shows. A Markdown
report is a review document that shortens long lists; see
[Review with Markdown](#review-with-markdown).

## Choose an output file

Repeat `-o` to write several views:

| Extension | Command | Content and use |
| --- | --- | --- |
| `.json` | `run` | Form. Reopen with `run`, inspect stages and evidence, or process as data. |
| `.md` | `run` | Markdown review of the architecture and its changes. |
| `.txt` | `run` | Plain-text report for terminal-oriented review. |
| `.html` | `run` | Self-contained interactive Explorer for browser review without a server. |
| `.json` | `check` | Structured Policy result. |
| `.md` | `check` | Markdown review of the Policy outcomes. |
| `.txt` | `check` | Plain-text Policy report. |
| `.sarif`, `.sarif.json` | `check` | SARIF 2.1.0 Policy result; keep as a build artifact. |

The JSON Form is reusable input. Plan Forms can contain stages, internal
comparisons, and a drift report; cross-input results have
`kind: "comparison"`. `check` loads a saved Form without recompiling it.
Reports and HTML exports are outputs, not analysis inputs. Each `-o` file
takes its format from its extension. Without `-o`, `--format` sets the format
of standard output. When exactly one `-o` file has an extension that names no
format, `--format` sets that file's format and standard output keeps the text
summary; without `--format`, that file is refused. `--format` is also refused
when it contradicts an extension or when more than one `-o` is given. `-o -`
is refused: standard output already carries the summary or the `--format`
output. For `check`, `.html` is refused even with `--format`: the
interactive export belongs to `run`. Each refusal exits `2`.

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

## Review with Markdown

A Markdown report is a review document for a pull request, a merge request, or
a CI job summary. The report of `run` opens with the heading
`## Rootform architecture`: its conclusion, the compared stages or inputs, any
limits of the evidence, change counts, reported drift, the changes, the
architecture, and provenance. The report of `check` opens with
`## Rootform Policies`: the verdict and the evaluated stage. For both sides of
a comparison Form, it states the overall verdict, the evaluation scope, and a
table of each side's stage, evaluation counts, and verdict. Each Policy then
follows with its requirement stated once above its evaluations, then coverage
gaps and provenance. Conclusions, verdicts, and limits are never folded.

Each list shows at most ten entries, spread across its statuses, such as added
and removed, and states how many it shows, for example `(10 of 23 shown)`. In
the report of `run`, a list longer than ten sits in a collapsed `<details>`
block whose summary gives its counts. The report of `check` keeps up to ten
evaluations per outcome in view, each with at most five evidence lines, so a
violation is never hidden in a fold. When a report shortens a list or its
evidence, its last line says so. Write the same report with `--details` to
list every entry and every evidence line; a list longer than ten is then
folded in both reports, and `--details` also adds depth such as semantics and
passed evaluations. Values from the input, such as addresses and names, are
escaped or written as code, so they cannot add links, markup, or folds.

Because each report opens with its own heading, an integration can join them
into one review. Leave a blank line between them, and let the status of
`check` decide the job rather than the command that joins the files:
[Write a review document](../guides/check-architecture.md#write-a-review-document)
composes both for one plan. The reports do not link to other files; publish
the Form, the Policy result, SARIF, or the HTML export separately when
reviewers need them.

## Analysis exit status

| Exit | Exact condition |
| --- | --- |
| `0` | The Form was produced or opened. |
| `2` | The command was used incorrectly. |
| `3` | An input was refused, `rootform.lock` is invalid, or a requested stage is unavailable. |
| `4` | An input, output, or `rootform.lock` file, or the explorer, failed. |

A difference, an indeterminate comparison entry, or reported drift is not an
analysis failure by itself.

## Policy check exit status

| Exit | Exact condition |
| --- | --- |
| `0` | Every selected Policy passed on every requested side. |
| `1` | A selected Policy was violated on a requested side. |
| `2` | The command was used incorrectly. |
| `3` | No verdict: indeterminate, no target, nothing selected, a side that could not be evaluated, an input that was refused, or an invalid `rootform.lock`. |
| `4` | An input, report, or `rootform.lock` file could not be read or written. |

Reports are written for every verdict. No selected Policies means no
compliance claim. For Policy coverage and results, see
[Check a Form with Policies](../guides/check-with-policies.md) and
[Follow a Policy through every outcome](../guides/check-architecture.md).

## Read the Policy result

The Policy result JSON has one `architectures` entry per evaluated
architecture: one for a plan or state, and one per evaluated side, Before then
After, for a comparison. Each entry holds its stage, status, Policy Packs,
Policies, evaluations, violations, diagnostics, and summary. The top-level
`scope`, `selection`, and `status` describe the whole check; `scope` is
absent when the check stopped before choosing what to evaluate. See the
[Policy result contract](../../contracts/policy-result.md) for exact fields.

## Interpret SARIF

SARIF has one run per evaluated architecture, like the Policy result. Each
run's properties carry that architecture's status and the overall status. A
Policy rule ID is `<pack>/<policy>`. A pass uses `kind: pass` and
`level: none`, a confirmed violation uses `kind: fail` and `level: error`,
and an indeterminate evaluation uses `kind: review` and `level: none`. Result
properties name the evaluated stage. A Policy execution failure appears under
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
