dialect "network-review" {
  version = "0.1.0"

  provider "hashicorp/random" {
    version = "= 3.9.1"
  }
}

concept "generated-identifier" {
  description = "An identifier generated for a service."
}

rule "service-name" {
  match {
    kind = "resource"
    type = "random_pet"
  }

  as = concept.generated-identifier
}
