rule "user-assigned-managed-identity" {
  match {
    type = "azurerm_user_assigned_identity"
  }

  as = rf.concept.service-identity

  # The resource id, the service principal object id and the client id are
  # unique across Azure tenants, so other providers can name the identity.
  identity {
    attributes = ["id", "principal_id", "client_id"]
    scope      = "global"
  }

  endpoint {
    attributes = ["id", "principal_id", "client_id"]
  }

  context {
    as  = context.ownership
    to  = concept.resource-group
    via = source.resource_group_name

    on_null  = "absent"
    on_empty = "absent"

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
