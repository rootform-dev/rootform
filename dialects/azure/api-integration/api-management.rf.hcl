# Maintained directly from pinned provider evidence.
rule "api-management" {
  match {
    type = "azurerm_api_management"
  }

  as = concept.api-gateway

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-management-api" {
  match {
    type = "azurerm_api_management_api"
  }

  as = concept.api-management-detail
}

rule "api-management-backend" {
  match {
    type = "azurerm_api_management_backend"
  }

  as = concept.api-management-detail
}

rule "api-management-gateway" {
  match {
    type = "azurerm_api_management_gateway"
  }

  as = concept.api-management-detail
}

rule "api-management-policy" {
  match {
    type = "azurerm_api_management_policy"
  }

  as = concept.api-management-detail
}

rule "api-management-product" {
  match {
    type = "azurerm_api_management_product"
  }

  as = concept.api-management-detail
}

rule "api-management-standalone-gateway" {
  match {
    type = "azurerm_api_management_standalone_gateway"
  }

  as = concept.api-gateway

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-management-workspace" {
  match {
    type = "azurerm_api_management_workspace"
  }

  as = concept.api-management-detail
}
