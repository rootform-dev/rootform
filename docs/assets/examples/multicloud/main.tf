# Synthetic architecture source for Rootform documentation, not a deployment recipe.
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

resource "google_container_cluster" "analytics" {
  name               = "analytics"
  location           = "europe-west1"
  network            = google_compute_network.google.id
  subnetwork         = google_compute_subnetwork.analytics.id
  initial_node_count = 2
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
