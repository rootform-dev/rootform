terraform {
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "= 3.9.1"
    }
  }
}

resource "random_pet" "service" {
  length = 2
}
