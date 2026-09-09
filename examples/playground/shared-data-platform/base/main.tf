# Reproducible Rootform Playground source. This is an architecture example, not a deployment recipe.
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "= 5.11.0"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "= 4.45.2"
    }
  }
}

resource "azurerm_resource_group" "azure" {
  name     = "azure"
  location = "West Europe"
}

resource "azurerm_virtual_network" "azure" {
  name                = "azure"
  resource_group_name = azurerm_resource_group.azure.name
  location            = azurerm_resource_group.azure.location
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "checkout" {
  name                 = "checkout"
  resource_group_name  = azurerm_resource_group.azure.name
  virtual_network_name = azurerm_virtual_network.azure.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_subnet" "data" {
  name                 = "data"
  resource_group_name  = azurerm_resource_group.azure.name
  virtual_network_name = azurerm_virtual_network.azure.name
  address_prefixes     = ["10.20.2.0/24"]
}

resource "azurerm_kubernetes_cluster" "checkout" {
  name                = "checkout"
  resource_group_name = azurerm_resource_group.azure.name
  location            = azurerm_resource_group.azure.location
  dns_prefix          = "checkout"
  default_node_pool {
    name           = "system"
    vm_size        = "Standard_D2_v2"
    node_count     = 2
    vnet_subnet_id = azurerm_subnet.checkout.id
  }
  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_private_dns_zone" "warehouse" {
  name                = "warehouse.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.azure.name
}

resource "azurerm_postgresql_flexible_server" "warehouse" {
  name                = "shared-warehouse"
  resource_group_name = azurerm_resource_group.azure.name
  location            = azurerm_resource_group.azure.location
  delegated_subnet_id = azurerm_subnet.data.id
  private_dns_zone_id = azurerm_private_dns_zone.warehouse.id
}

resource "azurerm_private_endpoint" "warehouse" {
  name                = "shared-warehouse"
  resource_group_name = azurerm_resource_group.azure.name
  location            = azurerm_resource_group.azure.location
  subnet_id           = azurerm_subnet.data.id

  private_service_connection {
    name                           = "warehouse"
    private_connection_resource_id = azurerm_postgresql_flexible_server.warehouse.id
    subresource_names              = ["postgresqlServer"]
    is_manual_connection           = false
  }
}

resource "google_compute_network" "google" {
  name                    = "google"
  auto_create_subnetworks  = false
}

resource "google_compute_subnetwork" "analytics" {
  name          = "analytics"
  network       = google_compute_network.google.id
  region        = "europe-west1"
  ip_cidr_range = "10.30.1.0/24"
}

resource "google_compute_subnetwork" "services" {
  name          = "services"
  network       = google_compute_network.google.id
  region        = "europe-west1"
  ip_cidr_range = "10.30.2.0/24"
}

resource "google_container_cluster" "analytics" {
  name               = "analytics"
  location           = "europe-west1"
  network            = google_compute_network.google.id
  subnetwork         = google_compute_subnetwork.analytics.id
  initial_node_count = 2
}

resource "google_cloud_run_v2_service" "ingest" {
  name     = "event-ingest"
  location = "europe-west1"

  template {
    vpc_access {
      network_interfaces {
        network    = google_compute_network.google.id
        subnetwork = google_compute_subnetwork.services.id
      }
    }
  }
}

resource "google_pubsub_topic" "events" {
  name = "platform-events"
}

resource "google_pubsub_subscription" "warehouse" {
  name  = "warehouse-events"
  topic = google_pubsub_topic.events.id
}

provider "kubernetes" {
  alias = "azure"
  host  = azurerm_kubernetes_cluster.checkout.kube_config[0].host
}

provider "kubernetes" {
  alias = "google"
  host  = google_container_cluster.analytics.endpoint
}

resource "kubernetes_namespace_v1" "checkout" {
  provider = kubernetes.azure
  metadata {
    name = "checkout"
  }
}

resource "kubernetes_deployment_v1" "api" {
  provider = kubernetes.azure
  metadata {
    name      = "api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }
}

resource "kubernetes_deployment_v1" "worker" {
  provider = kubernetes.azure
  metadata {
    name      = "worker"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }
}

resource "kubernetes_service_v1" "api" {
  provider = kubernetes.azure
  metadata {
    name      = "api"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }
}

resource "kubernetes_ingress_v1" "checkout" {
  provider = kubernetes.azure
  metadata {
    name      = "checkout"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "checkout" {
  provider = kubernetes.azure
  metadata {
    name      = "checkout"
    namespace = kubernetes_namespace_v1.checkout.metadata[0].name
  }
}

resource "kubernetes_namespace_v1" "analytics" {
  provider = kubernetes.google
  metadata {
    name = "analytics"
  }
}

resource "kubernetes_stateful_set_v1" "warehouse" {
  provider = kubernetes.google
  metadata {
    name      = "warehouse"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }
}

resource "kubernetes_deployment_v1" "analytics_api" {
  provider = kubernetes.google
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }
}

resource "kubernetes_service_v1" "analytics_api" {
  provider = kubernetes.google
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }
}

resource "kubernetes_namespace_v1" "batch" {
  provider = kubernetes.google
  metadata {
    name = "batch"
  }
}

resource "kubernetes_deployment_v1" "batch" {
  provider = kubernetes.google
  metadata {
    name      = "daily-models"
    namespace = kubernetes_namespace_v1.batch.metadata[0].name
  }
}

resource "vault_namespace" "platform" {
  path = "platform"
}

resource "vault_auth_backend" "kubernetes" {
  namespace = vault_namespace.platform.path
  type      = "kubernetes"
  path      = "kubernetes"
}

resource "vault_kubernetes_auth_backend_config" "checkout" {
  namespace       = vault_namespace.platform.path
  backend         = vault_auth_backend.kubernetes.path
  kubernetes_host = azurerm_kubernetes_cluster.checkout.kube_config[0].host
}

resource "vault_auth_backend" "analytics" {
  namespace = vault_namespace.platform.path
  type      = "kubernetes"
  path      = "analytics"
}

resource "vault_kubernetes_auth_backend_config" "analytics" {
  namespace       = vault_namespace.platform.path
  backend         = vault_auth_backend.analytics.path
  kubernetes_host = google_container_cluster.analytics.endpoint
}

resource "grafana_organization" "observability" {
  name = "observability"
}

resource "grafana_data_source" "metrics" {
  name   = "metrics"
  type   = "prometheus"
  org_id = grafana_organization.observability.id
}

resource "grafana_data_source" "logs" {
  name   = "logs"
  type   = "loki"
  org_id = grafana_organization.observability.id
}

resource "grafana_data_source" "traces" {
  name   = "traces"
  type   = "tempo"
  org_id = grafana_organization.observability.id
}
