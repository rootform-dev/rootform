# Rootform OCI Core Profile

Profile identifier: `rootform-oci-core-v1`.

This profile defines only OCI Distribution behavior Rootform needs to publish
and consume Dialects, Dialect indexes, and Policy Packs. It applies equally to
hosted, self-managed, public, and private registries. Passing this profile says
nothing about registry features outside this boundary.

## Content contract

Registry must preserve and return OCI image manifests with schema version `2`,
descriptor digests and sizes, `artifactType`, custom config and layer media
types, and manifest annotations byte-for-byte. OCI manifest schema version `2`
is defined by OCI and is unrelated to Rootform document `format_version`,
which remains `"1"`.

Rootform dialect content uses:

- artifact type `application/vnd.rootform.dialect.v1`;
- config type `application/vnd.rootform.dialect.manifest.v1+json`;
- layer type `application/vnd.rootform.dialect.layer.v1.tar+gzip`.

Rootform index content uses:

- artifact type `application/vnd.rootform.dialect-index.v1`;
- config type `application/vnd.rootform.dialect-index.config.v1+json`;
- layer type `application/vnd.rootform.dialect-index.v1+json`.

Rootform Policy Pack content uses:

- artifact type `application/vnd.rootform.policy-pack.v1`;
- config type `application/vnd.rootform.policy-pack.manifest.v1+json`;
- layer type `application/vnd.rootform.policy-pack.layer.v1.tar+gzip`.

Policy Pack V0 defines no index artifact.

Every descriptor uses SHA-256. Rootform validates returned digest, size, media
type, manifest shape, config, layer, and compiled semantic and presentation
identity. Unknown OCI annotations may coexist with supported standard
annotations. Invalid known provenance values still fail.

## Required distribution operations

Registry must implement standard OCI Distribution endpoints needed for:

- manifest resolution by tag or digest with `HEAD` or `GET`;
- manifest fetch by digest with `GET`;
- blob existence checks with `HEAD`;
- blob fetch by digest with `GET`, including standard redirects;
- two-step monolithic blob upload: initiation with `POST`, then completion with
  content and digest-bearing `PUT`;
- manifest and tag creation with `PUT`.

Rootform never enumerates repositories or tags. Dialect discovery happens
through known index or direct artifact references. Policy Pack selection uses
an explicit direct artifact reference. Locked acquisition resolves each
manifest by exact digest from repository recorded in `rootform.lock`.

## Authentication

Anonymous access is valid when registry permits it. Private access uses OCI
Distribution HTTP authentication challenges returned by attempted repository
operations, through Docker-compatible credentials: host-specific `credHelpers`,
global `credsStore`, then matching `auths`. Basic credentials and Bearer
challenge/token exchange are supported by shared ORAS client.

Credentials are selected per registry host. Rootform accepts no credential
flag, writes no Docker configuration, and records no username, password, token,
header, helper, or config path in lock, cache evidence, vendor, or command
output.

## Publication semantics

Repository must already exist when registry requires provisioning. Rootform
preflights every destination tag, pushes only missing descriptor graphs, then
resolves and repulls exact digest before success. Existing equal digest is
idempotent; existing different digest fails before first write.

Dialect tags are `dialect-<name>-<version>`. Generic index publication uses
immutable `index-sha256-<manifest-hex>` tags. Moving
`official-index-v1` belongs only to separately authorized official publication.
Policy Pack tags are `policy-pack-<name>-<version>` and no Policy Pack index or
mutable discovery tag exists in V0.
Registry-side tag immutability or serialized publishers is recommended where
late concurrent writers must be excluded.

## Explicitly outside profile

Profile does not require:

- Referrers API or artifact relationship traversal;
- registry catalog, repository listing, or tag listing;
- manifest or blob deletion;
- chunked `PATCH` blob uploads;
- cross-repository blob mounting;
- signatures, attestations, transparency logs, or trust policy;
- SBOM storage as dialect artifact;
- VCS access or registry-specific metadata APIs;
- server-side semantic version selection.

Registries may provide these features. Rootform V0 neither calls nor depends on
them.

## Portability test

Registry compatibility is established only by reusable Rootform qualification
against real endpoint. Test publishes custom media types, pulls direct Dialect
and Policy Pack artifacts by tag and digest, consumes additional Dialect index,
reacquires locked content into empty stores, repairs both vendor trees from
exact pins, verifies offline vendor execution, checks standard provenance, and
rejects source or digest drift.

Local qualification covers CNCF Distribution with anonymous, private Basic,
TLS, and Docker credential-helper paths. Candidate qualification against a
transient public GHCR package covers Bearer challenge exchange under GitHub
Actions' repository-inherited package visibility. Qualification content is
synthetic, and the package is deleted before the job ends. Hosted registry
compatibility is reported only for products that pass same profile suite.

Related contracts:

- [`dialect-distribution.md`](dialect-distribution.md);
- [`policy-pack-distribution.md`](policy-pack-distribution.md);
- [`rootform-lock.md`](rootform-lock.md);
- [`../docs/offline-security.md`](../docs/offline-security.md).
