concept "data-transformation" {
  description = "A durable Vault Transform data-protection transformation."
}

concept "encryption-configuration" {
  description = "A key distribution, replication, transform, or cache setting supporting Vault encryption."
}

concept "key-management-integration" {
  description = "A Vault Key Management integration distributing keys to an external key service."
}

rule "gcpkms-secret-backend-key" {
  match {
    type = "vault_gcpkms_secret_backend_key"
  }

  as = concept.encryption-key

  identity {
    attributes = ["key_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["key_name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "keymgmt-aws-kms" {
  match {
    type = "vault_keymgmt_aws_kms"
  }

  as = concept.key-management-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "keymgmt-azure-kms" {
  match {
    type = "vault_keymgmt_azure_kms"
  }

  as = concept.key-management-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "keymgmt-distribute-key" {
  match {
    type = "vault_keymgmt_distribute_key"
  }

  as = concept.encryption-configuration

  contribution {
    to       = rule.keymgmt-key
    via      = source.key_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared encryption-key instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.key-management-integration
    via      = source.kms_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "keymgmt-gcp-kms" {
  match {
    type = "vault_keymgmt_gcp_kms"
  }

  as = concept.key-management-integration

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "keymgmt-key" {
  match {
    type = "vault_keymgmt_key"
  }

  as = concept.encryption-key

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "keymgmt-replicate-key" {
  match {
    type = "vault_keymgmt_replicate_key"
  }

  as = concept.encryption-configuration
}

rule "managed-keys" {
  match {
    type = "vault_managed_keys"
  }

  as = concept.encryption-configuration
}

rule "transform-alphabet" {
  match {
    type = "vault_transform_alphabet"
  }

  as = concept.encryption-configuration
}

rule "transform-key-configuration" {
  match {
    type = "vault_transform_key_configuration"
  }

  as = concept.encryption-configuration
}

rule "transform-role" {
  match {
    type = "vault_transform_role"
  }

  as = concept.encryption-configuration
}

rule "transform-template" {
  match {
    type = "vault_transform_template"
  }

  as = concept.encryption-configuration
}

rule "transform-transformation" {
  match {
    type = "vault_transform_transformation"
  }

  as = concept.data-transformation

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "transit-secret-backend-key" {
  match {
    type = "vault_transit_secret_backend_key"
  }

  as = concept.encryption-key

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "transit-secret-cache-config" {
  match {
    type = "vault_transit_secret_cache_config"
  }

  as = concept.encryption-configuration

  contribution {
    to       = concept.secrets-engine
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}
