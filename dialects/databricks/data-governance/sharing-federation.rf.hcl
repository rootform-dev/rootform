concept "lakehouse-federation-connection" {
  description = "A Unity Catalog connection to an external data system for Lakehouse Federation."
}

concept "delta-share" {
  description = "A governed collection of data assets shared through Delta Sharing."
}


concept "delta-sharing-provider" {
  description = "An external organization providing data through Delta Sharing."
}

concept "sharing-configuration" {
  description = "A sharing, provider, recipient, or catalog integration configuration."
}

rule "lakehouse-federation-connection" {
  match {
    type = "databricks_connection"
  }

  as = concept.lakehouse-federation-connection

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.unity-catalog-metastore
    via      = source.metastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "delta-share" {
  match {
    type = "databricks_share"
  }

  as = concept.delta-share

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}


rule "delta-sharing-provider" {
  match {
    type = "databricks_provider"
  }

  as = concept.delta-sharing-provider

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}
