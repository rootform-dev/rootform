# Installation

No supported public release exists yet. Commands below define future verified
flow and private migration testing.

1. Select exact version; never install mutable `latest` in automation.
2. Download archive matching operating system and architecture.
3. Download `SHA256SUMS` from same release.
4. Verify archive SHA-256 before extraction.
5. Read `ROOTFORM-BINARY-LICENSE.txt` and `THIRD_PARTY_NOTICES.txt` inside
   archive.
6. Place executable on `PATH`.
7. Install exact official dialect version from `rootform-dev/dialects` or use
   project-vendored `.rootform/dialects/`.

Supported target claims appear only in release manifest. Cross-built but
unexecuted target remains unclaimed.

GitHub Action users may use `rootform-dev/action/setup@v1` after owner publishes
`v1`. Private migration tests supply optional read token because GitHub's
workflow token cannot read another private repository. Public releases require
no account or entitlement.
