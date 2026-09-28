# restored-drift

Synthetic plan JSON written by hand in the Terraform plan JSON format 1.2 for
the comparisons documentation. Neither Terraform nor OpenTofu produced it, it
has no saved plan, and it describes no real infrastructure. It is not a
qualified producer export.

It declares the KMS keys `aws_kms_key.primary` and `aws_kms_key.standby` and
the alias `aws_kms_alias.app`. The embedded AWS Dialect's `aws.rule.kms-alias`
Rule interprets the alias as a Contribution to the key its `target_key_id`
names.

- Recorded: the alias targets the primary key.
- Refreshed: an out-of-band change retargeted the alias to the standby key;
  `resource_drift` reports it as an in-place update.
- Planned: the plan updates the alias in place to target the primary key
  again.

Reported drift and Planned changes each change the Contribution in opposite
directions, and Net change reports both fact changes as cancelled.
