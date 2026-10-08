concept "hyperdrive-configuration" {
  description = "A Cloudflare Hyperdrive database accelerator and connection pool."
}

rule "d1-database" {
  match {
    type = "cloudflare_d1_database"
  }

  as = rf.concept.managed-database

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "hyperdrive-config" {
  match {
    type = "cloudflare_hyperdrive_config"
  }

  as = concept.hyperdrive-configuration

  relation "connects-to" {
    to       = rf.concept.managed-database
    via      = source.origin.host
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "connects-through" {
    to       = concept.connectivity-service
    via      = source.origin.service_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
