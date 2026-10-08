dialect "example" {
  version = "0.1.0"
  provider "hashicorp/aws" { version = ">= 6.0.0" }
}
rule "vpc" {
  match { type = "aws_vpc" }
  as = rf.concept.virtual-network
  identity { attributes = ["name"] }
  endpoint { attributes = ["id"] }
}
rule "subnet" {
  match {
    type = "aws_subnet"
    where = source.metadata[0].name == "x"
  }
  as = rf.concept.subnet
  context {
    as = rf.context.network
    to = rf.concept.virtual-network
    via = source.vpc_id
    on_null = "absent"
    on_empty = "absent"
    match {
      by = target.name
      strategy = "exact"
    }
  }
  context "provider-location" {
    to = rf.concept.virtual-network
    via = provider.host
    on_null = "absent"
    on_empty = "absent"
  }
}
rule "root" {
  match { type = "aws_lb" }
  as = rf.concept.virtual-network
  composition {
    member "proxy" {
      via = source.vpc_id
      match { type = "aws_lb_target_group" }
    }
    member "backend" {
      via = member.proxy.backend_id
      match { type = "aws_subnet" }
    }
  }
}
