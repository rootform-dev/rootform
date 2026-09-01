# Installation

1. Select exact version; never install mutable `latest` in automation.
2. Download archive matching operating system and architecture.
3. Download `SHA256SUMS` from same release.
4. Verify archive SHA-256 before extraction.
5. Read `ROOTFORM-BINARY-LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` inside
   archive. Rootform-owned executable code uses Elastic License 2.0
   (`Elastic-2.0`).
6. Place executable on `PATH`.
7. From project root, run `rootform run .`, `rootform build .`, or
   `rootform check .`. Shared preparation detects and installs missing dialects,
   creates deterministic `rootform.lock`, then resumes original command. Review
   and commit generated lock. Automation may prepare explicitly with
   `rootform init . --no-input`.

Initialization stores immutable dialect versions under `~/.rootform/dialects/`
and redownloadable data under `~/.rootform/cache/` and
`~/.rootform/indexes/`. `ROOTFORM_HOME` replaces entire home. Projects may
instead vendor `.rootform/dialects/`, which becomes their exclusive dialect
source.

Supported target claims appear only in release manifest. Cross-built but
unexecuted target remains unclaimed.

GitHub Action users may install Rootform with `rootform-dev/action/setup@v1`.
