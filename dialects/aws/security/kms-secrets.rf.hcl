rule "kms-key" {
  match {
    type = "aws_kms_key"
  }

  as = concept.encryption-key

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "kms-alias" {
  match {
    type = "aws_kms_alias"
  }

  as = concept.key-alias

  contribution {
    to       = concept.encryption-key
    via      = source.target_key_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared encryption-key instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
