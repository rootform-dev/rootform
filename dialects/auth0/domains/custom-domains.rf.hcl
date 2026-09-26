concept "domain-configuration" {
  description = "Default-domain or verification configuration supporting an Auth0 custom domain."
}

concept "identity-domain" {
  description = "A custom domain exposing an Auth0-hosted identity endpoint."
}

rule "custom-domain" {
  match {
    type = "auth0_custom_domain"
  }

  as = concept.identity-domain

  identity {
    attributes = ["id", "domain"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "domain"]
  }
}

rule "custom-domain-default" {
  match {
    type = "auth0_custom_domain_default"
  }

  as = concept.domain-configuration

  contribution {
    to       = concept.identity-domain
    via      = source.domain
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.domain
      strategy = "exact"
    }

    # Shared identity-domain instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "custom-domain-lookup" {
  match {
    kind = "data"
    type = "auth0_custom_domain"
  }

  as = concept.identity-domain

  identity {
    attributes = ["id", "domain"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "domain"]
  }
}

rule "custom-domain-verification" {
  match {
    type = "auth0_custom_domain_verification"
  }

  as = concept.domain-configuration

  contribution {
    to       = concept.identity-domain
    via      = source.custom_domain_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared identity-domain instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
