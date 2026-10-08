# Policy Pack examples

Policy Packs evaluate architecture facts established by Dialects. Each pack
has one `policy_pack` declaration and `.rf.hcl` or `.rf.json` source. File paths
do not define Policy identity.

[`baseline/`](baseline/) is a synthetic example with two Policies: managed
databases and Kubernetes clusters must have virtual-network or subnet context.
It demonstrates authoring and evaluation; review its targets and coverage
before using it as a security gate.

## Check the sample

Run from the repository root:

```sh
rootform fmt --check policy-packs/baseline
rootform list policies --policy-pack ./policy-packs/baseline
rootform check ./examples/playground/commerce-platform/head/plan.json \
  --plan-file ./examples/playground/commerce-platform/head/plan.tfplan \
  --project ./examples/playground/commerce-platform/head \
  --policy-pack ./policy-packs/baseline
```

Save a Form to reuse the same evidence in later checks. To select this pack for
a project, run `rootform add policy-packs ./policy-packs/baseline`; the selection
and content digest go into `rootform.lock`.

[Write a Policy Pack](../docs/language/write-policy-pack.md) covers source and
evaluation. [Add external content](../docs/guides/external-content.md) covers
local and OCI selections. Packaging and publication follow the
[Policy Pack distribution contract](../contracts/policy-pack-distribution.md).
