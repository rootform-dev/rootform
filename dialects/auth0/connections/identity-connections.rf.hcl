concept "identity-connection" {
  description = "An Auth0 Connection sourcing identities from an enterprise provider, social provider, database, or passwordless method."
}

rule "connection" {
  match {
    type = "auth0_connection"
  }

  as = concept.identity-connection

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "connection-lookup" {
  match {
    kind = "data"
    type = "auth0_connection"
  }

  as = concept.identity-connection

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
