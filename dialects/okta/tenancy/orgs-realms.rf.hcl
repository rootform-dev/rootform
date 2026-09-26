concept "identity-realm" {
  description = "An Okta Realm partitioning users within an organization."
}

concept "identity-tenant" {
  description = "An Okta organization acting as an identity tenant boundary."
}

rule "org-configuration" {
  match {
    type = "okta_org_configuration"
  }

  as = concept.identity-tenant
}

rule "org-metadata-lookup" {
  match {
    kind = "data"
    type = "okta_org_metadata"
  }

  as = concept.identity-tenant
}

rule "realm" {
  match {
    type = "okta_realm"
  }

  as = concept.identity-realm

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "realm-assignment" {
  match {
    type = "okta_realm_assignment"
  }

  as = concept.authentication-configuration

  contribution {
    to       = concept.identity-realm
    via      = source.realm_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "realm-assignment-lookup" {
  match {
    kind = "data"
    type = "okta_realm_assignment"
  }

  as = concept.authentication-configuration

  contribution {
    to       = concept.identity-realm
    via      = source.realm_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "realm-lookup" {
  match {
    kind = "data"
    type = "okta_realm"
  }

  as = concept.identity-realm

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
