# Changelog

All notable public Rootform distribution changes will be recorded here.

## Unreleased

- Restored `rootform check` as the Policy gate. It evaluates the selected
  Policies against one stage of a plan, state, or saved Form (the After side of
  a comparison Form by default), never a plan's reconstructed Recorded stage,
  and exits `0` passed, `1` violated, `3` no verdict, `2` usage, or `4`
  when a report cannot be written. `rootform run` only analyzes: it no longer
  accepts `--policy`, `--policy-pack`, or SARIF output.
- Documented the Policy result written by `check` as JSON, Markdown, text, and
  SARIF 2.1.0 in `contracts/policy-result.md`; results identify the evaluated
  Form by canonical digest and never embed it.
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
