concept "domain-configuration" {
  description = "Certificate or verification configuration supporting an Okta custom domain."
}

concept "identity-domain" {
  description = "A custom domain exposing an Okta-hosted identity endpoint."
}

rule "domain" {
  match {
    type = "okta_domain"
  }

  as = concept.identity-domain

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "domain-certificate" {
  match {
    type = "okta_domain_certificate"
  }

  as = concept.domain-configuration

  contribution {
    to       = concept.identity-domain
    via      = source.domain_id
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

rule "domain-lookup" {
  match {
    kind = "data"
    type = "okta_domain"
  }

  as = concept.identity-domain

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "domain-verification" {
  match {
    type = "okta_domain_verification"
  }

  as = concept.domain-configuration

  contribution {
    to       = concept.identity-domain
    via      = source.domain_id
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
