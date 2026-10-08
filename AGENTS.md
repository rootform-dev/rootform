# Rootform contribution contract

- This repository owns public contracts, documentation, official Dialects,
  distribution tooling and the Apache-2.0 Go module in `cli/`.
- Keep compiler and renderer source outside this repository. Cross-repository
  inputs use exact commits, immutable artifacts and verified digests.
- Retain licenses, notices, technical attribution and export provenance.
  Synthetic examples contain no customer input or credentials.
  Examples are evidence, never authoritative Terraform input.
- Private notes, prompts, research, session reports and personal paths stay
  outside this checkout. Public files and messages explain product changes,
  contributor commands, validation and required provenance only.
- Bun is the JavaScript package manager. Pin tools and Actions exactly.
  Generate schemas, references and lockfiles with their owning tools.
- Follow [Writing for Rootform](docs/contributing/writing.md).
- Contributions target `dev`. `main` advances through a checked `dev` promotion.
  Never push directly to either branch or rewrite existing history.
- Rootform chooses the distributed binary version; Engine builds the requested
  commit, candidate qualifies it and publish publishes it. Publication requires
  explicit authorization.
  Visibility changes, Marketplace publication and production site deployment
  also require explicit authorization. Final packaging preserves the verified
  handoff's executable bytes. Release inputs have immutable identities and use
  no symlink, personal path, relative source location or worktree assumption.
- Configure `git config core.hooksPath .githooks`. Validate public messages before
  sending; keep pull requests concise and squash bodies empty by default.
- Run `bun run verify` before delivery. Report missing proof precisely.
