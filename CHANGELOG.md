# Changelog

All notable public Rootform distribution changes will be recorded here.

## Unreleased

- The Markdown reports of `rootform run` and `rootform check` are review
  documents for a pull request, a merge request, or a CI job summary. They
  open with `## Rootform architecture` and `## Rootform Policies`, so both can
  be appended into one review, and lead with the conclusion or verdict and its
  scope; limits stay visible. A check of both sides states the overall
  verdict, the evaluation scope, and each side's verdict apart. Each list
  shows at most ten entries with exact counts and folds when longer;
  `--details` lists every entry. The Policy guide joins both reports with a
  blank line and keeps the status of `check`. Text, JSON, and SARIF output
  are unchanged.
- Gave every command one interaction contract. Help leads with usage and
  examples before grouped options. `-o` always names a file and `--format`
  always names a format: `list` and `show` take `--format` where they took
  `-o`, and `init --details` replaces `-v` and `--verbose`.
  Exit statuses mean the same thing in every command: `0` done, `1` a decided
  negative answer, `2` incorrect use, `3` no answer from the input,
  selection, or evidence, and `4` an operational failure. Standard output
  carries only the requested result; progress and errors go to standard error.
- An invalid `rootform.lock` now exits `3` in `add`, `remove`, `update`,
  `validate`, and `test`, as in every other command that reads it. `init` and
  `vendor` exit `4` when the project directory cannot be read, and `list` and
  `show` refuse a `--project` that names no directory with `2`. Help and
  errors name the Rootform home where they said store.
- `rootform explain instance` and `rootform explain rule` replace
  `explain architecture` and `explain semantics` and require `--input`;
  `rootform explain policy` explains an outcome recorded in a saved Policy
  result named by `--result`, without evaluating it again.
- A saved comparison Form reopens alone with `rootform run` and is refused as a
  `--diff` operand; `--before-side` and `--after-side` are removed.
- Restored `rootform check` as the Policy gate. It evaluates the selected
  Policies against a plan's Planned architecture, a state's Recorded
  architecture, or both sides of a comparison Form (`--side` keeps one), never
  a plan's reconstructed Recorded stage, and exits `0` passed, `1` violated,
  `3` no verdict, `2` usage, or `4` when an input or report file cannot be
  read or written. `rootform run` only analyzes: it no longer accepts
  `--policy`, `--policy-pack`, or SARIF output.
- Documented the Policy result written by `check` as JSON, Markdown, text, and
  SARIF 2.1.0 in `contracts/policy-result.md` and
  `schemas/policy-result.schema.json`; a result records each evaluated
  architecture separately, identifies the evaluated Form by canonical digest,
  and never embeds it.
- The portable CI script now saves the Form with `run`, then gates that saved
  Form with `check` when a Policy selection exists, keeping each phase's
  status and reports.
- Named the saved result a Form, validated by `schemas/form.schema.json` and
  `rootform validate form`. A state or plan Form keeps its stage architectures
  under `stages`; a comparison Form embeds its two input Forms. A plan that
  omits `prior_state` has an empty Refreshed stage and a Recorded stage rebuilt
  from its drift records. Carried instances stay unverified: they prove no
  empty population and cannot decide a Policy.
- Replaced pre-v0.1 language and document model with RF Vocabulary,
  resource bases, owner-first symbols, explicit interpretation, and immutable
  supplied release set.
- Replaced discovery-driven project preparation with exact format-1 lock,
  `$ROOTFORM_HOME/dialects`, deterministic vendor paths, and no implicit lock
  mutation.
- Made Policy Pack source portable; semantic dependencies are derived during
  exact linking.
- Removed official Dialect index/publication workflow while retaining generic
  third-party Dialect and Policy Pack OCI package/publish commands.
