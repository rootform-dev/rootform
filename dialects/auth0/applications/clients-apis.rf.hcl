concept "api-resource-server" {
  description = "An API registered as an Auth0 resource server for authorized applications."
}

rule "client" {
  match {
    type = "auth0_client"
  }

  as = concept.identity-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "defaults-to-organization" {
    to       = concept.customer-organization
    via      = source.default_organization[0].organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-api" {
    to       = concept.api-resource-server
    via      = source.resource_server_identifier
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.identifier
      strategy = "exact"
    }
  }
}

rule "client-cimd" {
  match {
    type = "auth0_client_cimd"
  }

  as = concept.identity-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "defaults-to-organization" {
    to       = concept.customer-organization
    via      = source.default_organization[0].organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "client-lookup" {
  match {
    kind = "data"
    type = "auth0_client"
  }

  as = concept.identity-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "defaults-to-organization" {
    to       = concept.customer-organization
    via      = source.default_organization[0].organization_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-api" {
    to       = concept.api-resource-server
    via      = source.resource_server_identifier
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.identifier
      strategy = "exact"
    }
  }
}

rule "resource-server" {
  match {
    type = "auth0_resource_server"
  }

  as = concept.api-resource-server

  identity {
    attributes = ["identifier"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "identifier"]
  }
}

rule "resource-server-lookup" {
  match {
    kind = "data"
    type = "auth0_resource_server"
  }

  as = concept.api-resource-server

  identity {
    attributes = ["identifier"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "identifier"]
  }
}
