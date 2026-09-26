concept "customer-key-management" {
  description = "MongoDB Atlas project-level encryption at rest using customer-managed cloud keys."
}

concept "security-configuration" {
  description = "A security configuration supporting a MongoDB Atlas project."
}

rule "encryption-at-rest" {
  match {
    type = "mongodbatlas_encryption_at_rest"
  }

  as = concept.customer-key-management

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-authorization" {
    to       = concept.cloud-provider-authorization
    via      = source.aws_kms_config[0].role_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.role_id
      strategy = "exact"
    }

    # Shared cloud-provider-authorization instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-authorization" {
    to       = concept.cloud-provider-authorization
    via      = source.azure_key_vault_config[0].role_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.role_id
      strategy = "exact"
    }

    # Shared cloud-provider-authorization instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-authorization" {
    to       = concept.cloud-provider-authorization
    via      = source.google_cloud_kms_config[0].role_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.role_id
      strategy = "exact"
    }

    # Shared cloud-provider-authorization instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "encryption-private-endpoint" {
  match {
    type = "mongodbatlas_encryption_at_rest_private_endpoint"
  }

  as = concept.private-endpoint

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "auditing" {
  match {
    type = "mongodbatlas_auditing"
  }

  as = concept.security-configuration

  contribution {
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
