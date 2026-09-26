terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
  }
}

resource "terraform_data" "unknown_id" {}

resource "azurerm_resource_group" "messaging" {
  name     = "messaging"
  location = "West Europe"
}

resource "azurerm_servicebus_namespace" "platform" {
  name                = "platform"
  location            = azurerm_resource_group.messaging.location
  resource_group_name = azurerm_resource_group.messaging.name
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "orders" {
  name         = "orders"
  namespace_id = azurerm_servicebus_namespace.platform.id
}

resource "azurerm_servicebus_topic" "events" {
  name         = "events"
  namespace_id = azurerm_servicebus_namespace.platform.id
}

resource "azurerm_servicebus_subscription" "worker" {
  name               = "worker"
  topic_id           = azurerm_servicebus_topic.events.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_queue" "literal" {
  name         = "literal"
  namespace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ServiceBus/namespaces/fx-literal-namespace-id"
}

resource "azurerm_servicebus_queue" "unknown" {
  name         = "unknown"
  namespace_id = terraform_data.unknown_id.id
}

resource "azurerm_servicebus_subscription" "literal" {
  name               = "literal"
  topic_id           = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ServiceBus/namespaces/fx-namespace/topics/fx-literal-topic-id"
  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "unknown" {
  name               = "unknown"
  topic_id           = terraform_data.unknown_id.id
  max_delivery_count = 10
}
