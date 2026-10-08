# Maintained directly from pinned provider evidence.
concept "ai-search-service" {
  description = "An Azure AI Search service."
}

rule "ai-search-service" {
  match {
    type = "azurerm_search_service"
  }

  as = concept.ai-search-service

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
