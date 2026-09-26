# Changelog

All notable public Rootform distribution changes will be recorded here.

## Unreleased

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
