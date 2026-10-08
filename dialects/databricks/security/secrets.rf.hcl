concept "secret-scope" {
  description = "A Databricks secret scope grouping sensitive configuration without exposing secret values."
}

concept "secret-configuration" {
  description = "A secret identity or access configuration whose value remains outside architecture output."
}

rule "secret-scope" {
  match {
    type = "databricks_secret_scope"
  }

  as = concept.secret-scope

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "secret" {
  match {
    type = "databricks_secret"
  }

  as = concept.secret-configuration

  contribution {
    to       = concept.secret-scope
    via      = source.scope
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "secret-acl" {
  match {
    type = "databricks_secret_acl"
  }

  as = concept.secret-configuration

  contribution {
    to       = concept.secret-scope
    via      = source.scope
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "unity-catalog-secret" {
  match {
    type = "databricks_secret_uc"
  }

  as = concept.secret-configuration
}

rule "service-principal-secret" {
  match {
    type = "databricks_service_principal_secret"
  }

  as = concept.secret-configuration
}
