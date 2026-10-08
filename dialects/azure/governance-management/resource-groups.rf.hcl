rule "resource-group" {
  match {
    type = "azurerm_resource_group"
  }

  as = concept.resource-group

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}
