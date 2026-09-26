concept "connection-configuration" {
  description = "Client enablement, SCIM, keys, or synchronization supporting an Auth0 Connection."
}

rule "connection-client" {
  match {
    type = "auth0_connection_client"
  }

  as = concept.connection-configuration

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

rule "connection-clients" {
  match {
    type = "auth0_connection_clients"
  }

  as = concept.connection-configuration

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

rule "connection-directory-synchronized-groups" {
  match {
    type = "auth0_connection_directory_synchronized_groups"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.directory-sync
    via      = source.connection_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "connection-directory-synchronized-groups-lookup" {
  match {
    kind = "data"
    type = "auth0_connection_directory_synchronized_groups"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.directory-sync
    via      = source.connection_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "connection-keys" {
  match {
    type = "auth0_connection_keys"
  }

  as = concept.connection-configuration

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

rule "connection-keys-lookup" {
  match {
    kind = "data"
    type = "auth0_connection_keys"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.identity-connection
    via      = source.connection_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "connection-scim-configuration" {
  match {
    type = "auth0_connection_scim_configuration"
  }

  as = concept.connection-configuration

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

rule "connection-scim-configuration-lookup" {
  match {
    kind = "data"
    type = "auth0_connection_scim_configuration"
  }

  as = concept.connection-configuration

  contribution {
    to       = concept.identity-connection
    via      = source.connection_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
