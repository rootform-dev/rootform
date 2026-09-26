concept "data-share" {
  description = "A Snowflake secure data share exposed to other accounts."
}

concept "listing" {
  description = "A Snowflake listing distributing a share or application package."
}

concept "failover-group" {
  description = "A Snowflake failover group replicating selected account objects."
}

concept "account-connection" {
  description = "A Snowflake client connection replicated across accounts for failover."
}

rule "share" {
  match {
    type = "snowflake_share"
  }

  as = concept.data-share

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "shared-with-account" {
    to       = concept.account
    via      = source.accounts[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "listing" {
  match {
    type = "snowflake_listing"
  }

  as = concept.listing

  relation "publishes-share" {
    to       = concept.data-share
    via      = source.share
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

}

rule "failover-group" {
  match {
    type = "snowflake_failover_group"
  }

  as = concept.failover-group

  relation "replicates-to-account" {
    to       = concept.account
    via      = source.allowed_accounts[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared account instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "replicates-database" {
    to       = concept.database
    via      = source.allowed_databases[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "replicates-share" {
    to       = concept.data-share
    via      = source.allowed_shares[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "primary-connection" {
  match {
    type = "snowflake_primary_connection"
  }

  as = concept.account-connection

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "fails-over-to-account" {
    to       = concept.account
    via      = source.enable_failover_to_accounts[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared account instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "secondary-connection" {
  match {
    type = "snowflake_secondary_connection"
  }

  as = concept.account-connection

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "replicates-connection" {
    to       = concept.account-connection
    via      = source.as_replica_of
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
