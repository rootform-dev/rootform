terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
    }
  }
}

# Kubernetes provider blocks that read an AKS kubeconfig host name their
# cluster by reference. Rootform pairs only the verified reference; the
# sensitive kubeconfig value is never read.

resource "azurerm_resource_group" "platform" {
  name     = "platform"
  location = "westeurope"
}

resource "azurerm_kubernetes_cluster" "runtime" {
  name                = "runtime"
  location            = azurerm_resource_group.platform.location
  resource_group_name = azurerm_resource_group.platform.name
  dns_prefix          = "runtime"

  default_node_pool {
    name       = "system"
    vm_size    = "Standard_D2ds_v5"
    node_count = 1
  }

  node_provisioning_profile {
    mode = "Manual"
  }

  identity {
    type = "SystemAssigned"
  }
}

provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.runtime.kube_config[0].host
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.runtime.kube_config[0].cluster_ca_certificate)
}

provider "kubernetes" {
  alias = "admin"
  host  = azurerm_kubernetes_cluster.runtime.kube_admin_config[0].host
}

# A host assembled by a template names no endpoint attribute: the cluster of
# this namespace stays unavailable.
provider "kubernetes" {
  alias = "templated"
  host  = "https://${azurerm_kubernetes_cluster.runtime.fqdn}:443"
}

resource "kubernetes_namespace_v1" "apps" {
  metadata {
    name = "apps"
  }
}

resource "kubernetes_namespace_v1" "operations" {
  provider = kubernetes.admin

  metadata {
    name = "operations"
  }
}

resource "kubernetes_namespace_v1" "templated" {
  provider = kubernetes.templated

  metadata {
    name = "templated"
  }
}
