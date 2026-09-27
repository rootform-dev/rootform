# Changelog

All notable public Rootform distribution changes will be recorded here.

## Unreleased

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
