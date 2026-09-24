---
title: "Use a local Dialect while authoring"
description: "Try a Dialect from a source directory without changing the project, then add it to the project's exact selection."
---

Write a Dialect next to your Terraform or OpenTofu code, try it on real input,
and adopt it into the project only when its results are right. Trying a
Dialect never changes `rootform.lock`; adopting it does, once.

Prerequisites:

- a Rootform project directory with Terraform or OpenTofu configuration;
- a Dialect source directory, here `dialects/payments` inside the project.
  [Write a Dialect](../dialect-authoring.md) covers its contents.

Run every command from the project root.

## Try the Dialect

Pass the source directory to any command that reads Dialects:

<!-- docs-check:local-dialect-1 -->
```sh
rootform build . --dialect ./dialects/payments
```

```text title="Standard error from the example"
Using payments 0.1.0 from ./dialects/payments for this command only
```

`--dialect` applies to one command. Rootform compiles the directory and adds
it to the active Dialects for that run. If the project already selects
`payments`, or if `payments` is an embedded Dialect, the local source takes
its place for that run. Repeat the flag to try several Dialects together.

Inspect what the Dialect contributes:

<!-- docs-check:local-dialect-2 -->
```sh
rootform list dialects payments -o wide --dialect ./dialects/payments
rootform show payments --dialect ./dialects/payments
```

## Iterate

Edit the source and run the same commands again. There is nothing to
reinstall, package, or record: each run compiles the directory as it is. A
compile error stops the command and points to the file and line in the source
directory.

## Add the Dialect to the project

When the results are right, select the Dialect:

<!-- docs-check:local-dialect-3 -->
```sh
rootform add dialects ./dialects/payments
```

```text title="Example result"
rootform.lock updated

  add      dialect payments 0.1.0  (dialects/payments)
```

Rootform compiles the directory, records its owner, version, content digest,
and project-relative path in `rootform.lock`, and creates the lock if the
project had none. Commit `rootform.lock` together with `dialects/payments`.
From now on, every command uses the Dialect without `--dialect`, on every
clone of the repository.

A source outside the project, such as `../shared-dialects/payments`, is
recorded the same way, but every machine that runs the project then needs
that sibling checkout at the same relative place. Vendor the project with
`rootform vendor`, or publish the Dialect, when that is not guaranteed.

If the owner is an embedded Dialect, `add` stops. Confirm the replacement
with `--replace`:

<!-- docs-check:local-dialect-4 -->
```sh
rootform add dialects ./dialects/aws --replace
```

## Record later changes

After you edit an added Dialect, normal commands stop because its content no
longer matches `rootform.lock`. The diagnostic names the selected owner and
points to `rootform update`.

Keep iterating with `--dialect`, which ignores the recorded digest. When the
change is ready, record it and commit the lock:

<!-- docs-check:local-dialect-5 -->
```sh
rootform update dialects payments
```

The lock diff shows the new version or content digest, so reviewers see that
the project's architecture meaning changed.

## Share the Dialect with other projects

A Dialect used by several repositories belongs in an OCI registry. Package and
publish it with `rootform publish dialects`, then add it in each project with
its reference:

<!-- docs-check:local-dialect-6 -->
```sh
rootform add dialects registry.example.com/acme/rootform/payments:0.1.0
```

To move a project from the local source to the published artifact, run
`rootform update dialects payments <reference>` with that exact reference.

## Remove the Dialect

<!-- docs-check:local-dialect-7 -->
```sh
rootform remove dialects payments
```

The source directory stays where it is. If the Dialect replaced an embedded
one, the embedded Dialect becomes active again.
