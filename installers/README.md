# Installation artifacts

`install.sh` and `install.ps1` are the reviewed source for the public installers.
`scripts/generate-installation.ts` reads one assembled release directory, verifies
its manifest, archive digests, and `SHA256SUMS`, then writes:

- `install` and `install.ps1`, with the exact release version embedded;
- `rootform.rb`, the Homebrew Cask for a tap or later upstream submission;
- three WinGet manifests under the `microsoft/winget-pkgs` directory layout.

Generate from exact final release assets:

```sh
bun scripts/generate-installation.ts \
  --version 0.1.0 \
  --release build/release \
  --output build/installers
```

The default archive URL is the versioned GitHub release path. Installer hosting
should serve the generated `install` and `install.ps1` bytes at `/install` and
`/install.ps1`. The website does not own an independent installer implementation.
The generated Cask and WinGet manifests are review artifacts until their
upstream package repositories accept them. No package manager receives a
repacked executable.

For native candidate qualification, `scripts/qualify-installation.ts` serves
the exact candidate release assets on localhost, generates local Cask and WinGet
manifests, and exercises download, checksum verification, installation, command
execution, and failure paths. The candidate workflow runs this on all five
supported native runners. On macOS it uses a temporary local Homebrew tap. On
Windows it enables WinGet local manifests for the ephemeral runner.

`ROOTFORM_RELEASE_BASE_URL`, `ROOTFORM_VERSION`, and `ROOTFORM_INSTALL_DIR` are
explicit installer test seams. HTTP is permitted only for loopback hosts; normal
downloads require HTTPS. Shell installation defaults to `$HOME/.local/bin` and
reports when that directory is not on `PATH`. PowerShell installation defaults
to `%LOCALAPPDATA%\Programs\Rootform` and adds that directory to the user and
current process `PATH`.

Publishing the GitHub release, routing the two installer URLs, submitting the
Cask and WinGet manifests, and publishing the OCI image remain separate owner
review steps. Candidate qualification never performs those publication steps.
