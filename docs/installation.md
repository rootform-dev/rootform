# Installation

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

GitHub Action users may install Rootform with `rootform-dev/action/setup@v1`.
