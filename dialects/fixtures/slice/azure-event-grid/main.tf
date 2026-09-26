terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
  }
}

resource "terraform_data" "unknown_id" {

}
resource "azurerm_resource_group" "platform" {
  name     = "platform"
  location = "West Europe"
}

resource "azurerm_eventhub" "handler" {
  message_retention = 1
  partition_count   = 1
  namespace_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.EventHub/namespaces/fx-handler-namespace-id"

  name = "handler"

}
resource "azurerm_servicebus_queue" "handler" {
  namespace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ServiceBus/namespaces/fx-handler-namespace-id"
  name         = "handler"
}
resource "azurerm_servicebus_topic" "handler" {
  namespace_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.ServiceBus/namespaces/fx-handler-namespace-id"
  name         = "handler"
}
resource "azurerm_linux_function_app" "handler" {
  storage_account_name = "fxf0a0a66db054"
  site_config {
  }
  resource_group_name = "fx-handler-resource-group-name"
  location            = "westeurope"
  service_plan_id     = azurerm_service_plan.handler.id
  name                = "handler"
}

# A literal plan ID makes the provider read the plan while planning; the
# fixture plans offline, so the function app uses a plan it creates.
resource "azurerm_service_plan" "handler" {
  name                = "handler-plan"
  resource_group_name = "fx-handler-resource-group-name"
  location            = "westeurope"
  os_type             = "Linux"
  sku_name            = "Y1"
}
resource "azurerm_storage_account" "handler" {
  name                     = "rootformhandler"
  resource_group_name      = azurerm_resource_group.platform.name
  location                 = azurerm_resource_group.platform.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_eventgrid_topic" "commerce" {
  name                = "commerce"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
}

resource "azurerm_eventgrid_domain" "partners" {
  name                = "partners"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
}

resource "azurerm_eventgrid_domain_topic" "orders" {
  name                = "orders"
  domain_name         = azurerm_eventgrid_domain.partners.name
  resource_group_name = azurerm_resource_group.platform.name
}

resource "azurerm_eventgrid_event_subscription" "commerce" {
  name                 = "commerce"
  scope                = azurerm_eventgrid_topic.commerce.id
  service_bus_queue_id = azurerm_servicebus_queue.handler.id
}

resource "azurerm_eventgrid_event_subscription" "orders" {
  name                 = "orders"
  scope                = azurerm_eventgrid_domain_topic.orders.id
  service_bus_queue_id = azurerm_servicebus_queue.handler.id
}

resource "azurerm_eventgrid_event_subscription" "eventhub" {
  name        = "eventhub"
  scope       = azurerm_resource_group.platform.id
  eventhub_id = azurerm_eventhub.handler.id
}

resource "azurerm_eventgrid_event_subscription" "queue" {
  name                 = "queue"
  scope                = azurerm_resource_group.platform.id
  service_bus_queue_id = azurerm_servicebus_queue.handler.id
}

resource "azurerm_eventgrid_event_subscription" "topic" {
  name                 = "topic"
  scope                = azurerm_resource_group.platform.id
  service_bus_topic_id = azurerm_servicebus_topic.handler.id
}

resource "azurerm_eventgrid_event_subscription" "function" {
  name  = "function"
  scope = azurerm_resource_group.platform.id
  azure_function_endpoint { function_id = azurerm_linux_function_app.handler.id }
}

resource "azurerm_eventgrid_event_subscription" "storage" {
  name  = "storage"
  scope = azurerm_resource_group.platform.id
  storage_queue_endpoint {
    storage_account_id = azurerm_storage_account.handler.id
    queue_name         = "events"
  }
}

resource "azurerm_eventgrid_event_subscription" "literal" {
  name        = "literal"
  scope       = azurerm_resource_group.platform.id
  eventhub_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.EventHub/namespaces/fx-namespace/eventhubs/fx-literal-eventhub-id"
}

resource "azurerm_eventgrid_event_subscription" "unknown" {
  name                 = "unknown"
  scope                = azurerm_resource_group.platform.id
  service_bus_queue_id = terraform_data.unknown_id.id
}

resource "azurerm_eventgrid_system_topic" "storage" {
  name                = "storage"
  resource_group_name = azurerm_resource_group.platform.name
  location            = azurerm_resource_group.platform.location
  source_resource_id  = azurerm_storage_account.handler.id
  topic_type          = "Microsoft.Storage.StorageAccounts"
}

resource "azurerm_eventgrid_system_topic_event_subscription" "eventhub" {
  name                = "eventhub"
  system_topic        = azurerm_eventgrid_system_topic.storage.name
  resource_group_name = azurerm_resource_group.platform.name
  eventhub_id         = azurerm_eventhub.handler.id
}

resource "azurerm_eventgrid_system_topic_event_subscription" "queue" {
  name                 = "queue"
  system_topic         = azurerm_eventgrid_system_topic.storage.name
  resource_group_name  = azurerm_resource_group.platform.name
  service_bus_queue_id = azurerm_servicebus_queue.handler.id
}

resource "azurerm_eventgrid_system_topic_event_subscription" "topic" {
  name                 = "topic"
  system_topic         = azurerm_eventgrid_system_topic.storage.name
  resource_group_name  = azurerm_resource_group.platform.name
  service_bus_topic_id = azurerm_servicebus_topic.handler.id
}

resource "azurerm_eventgrid_system_topic_event_subscription" "function" {
  name                = "function"
  system_topic        = azurerm_eventgrid_system_topic.storage.name
  resource_group_name = azurerm_resource_group.platform.name
  azure_function_endpoint { function_id = azurerm_linux_function_app.handler.id }
}

resource "azurerm_eventgrid_system_topic_event_subscription" "storage" {
  name                = "storage"
  system_topic        = azurerm_eventgrid_system_topic.storage.name
  resource_group_name = azurerm_resource_group.platform.name
  storage_queue_endpoint {
    storage_account_id = azurerm_storage_account.handler.id
    queue_name         = "events"
  }
}

resource "azurerm_eventgrid_system_topic_event_subscription" "literal" {
  name                = "literal"
  system_topic        = "storage"
  resource_group_name = azurerm_resource_group.platform.name
  eventhub_id         = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.EventHub/namespaces/fx-namespace/eventhubs/fx-literal-eventhub-id"
}

resource "azurerm_eventgrid_system_topic_event_subscription" "unknown" {
  name                 = "unknown"
  system_topic         = terraform_data.unknown_id.id
  resource_group_name  = azurerm_resource_group.platform.name
  service_bus_queue_id = terraform_data.unknown_id.id
}
