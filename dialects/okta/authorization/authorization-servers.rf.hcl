concept "authorization-server" {
  description = "An Okta custom Authorization Server that mints OAuth and OIDC tokens."
}

rule "auth-server" {
  match {
    type = "okta_auth_server"
  }

  as = concept.authorization-server

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "auth-server-default" {
  match {
    type = "okta_auth_server_default"
  }

  as = concept.authorization-server

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "auth-server-lookup" {
  match {
    kind = "data"
    type = "okta_auth_server"
  }

  as = concept.authorization-server

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "oauth-authorization-server-lookup" {
  match {
    kind = "data"
    type = "okta_oauth_authorization_server"
  }

  as = concept.authorization-server

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
