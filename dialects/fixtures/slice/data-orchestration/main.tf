terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kestra = {
      source  = "kestra-io/kestra"
      version = "= 0.24.3"
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.9.1"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "= 5.11.0"
    }
  }
}
