concept "directory-sync" {
  description = "An Auth0 Directory Sync integration attached to an enterprise Connection."
}

rule "connection-directory" {
  match {
    type = "auth0_connection_directory"
  }

  as = concept.directory-sync

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "synchronizes-connection" {
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

rule "connection-directory-lookup" {
  match {
    kind = "data"
    type = "auth0_connection_directory"
  }

  as = concept.directory-sync

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  relation "synchronizes-connection" {
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
