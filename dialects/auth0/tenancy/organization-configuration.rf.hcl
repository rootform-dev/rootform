rule "organization-client" {
  match {
    type = "auth0_organization_client"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.identity-application
    via      = source.client_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-client-grant" {
  match {
    type = "auth0_organization_client_grant"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-client-lookup" {
  match {
    kind = "data"
    type = "auth0_organization_client"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.identity-application
    via      = source.client_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-clients" {
  match {
    type = "auth0_organization_clients"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-connection" {
  match {
    type = "auth0_organization_connection"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.identity-connection
    via      = source.connection_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-connections" {
  match {
    type = "auth0_organization_connections"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-discovery-domain" {
  match {
    type = "auth0_organization_discovery_domain"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "organization-discovery-domains" {
  match {
    type = "auth0_organization_discovery_domains"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.customer-organization
    via      = source.organization_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
