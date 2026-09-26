rule "vpc" {
  match {
    type = "aws_vpc"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "cidr_block"]
  }
}

rule "subnet" {
  match {
    type = "aws_subnet"
  }

  as = rf.concept.subnet

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vpc-endpoint" {
  match {
    type = "aws_vpc_endpoint"
  }

  as = concept.private-endpoint

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "ec2-transit-gateway" {
  match {
    type = "aws_ec2_transit_gateway"
  }

  as = concept.transit-gateway

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "ec2-transit-gateway-vpc-attachment" {
  match {
    type = "aws_ec2_transit_gateway_vpc_attachment"
  }

  as = concept.transit-gateway-attachment

  contribution {
    to       = concept.transit-gateway
    via      = source.transit_gateway_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "route-table" {
  match {
    type = "aws_route_table"
  }

  as = concept.route-table

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "security-group" {
  match {
    type = "aws_security_group"
  }

  as = concept.security-group

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "network-acl" {
  match {
    type = "aws_network_acl"
  }

  as = concept.network-acl

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "internet-gateway" {
  match {
    type = "aws_internet_gateway"
  }

  as = concept.internet-gateway

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "nat-gateway" {
  match {
    type = "aws_nat_gateway"
  }

  as = concept.managed-nat

  context {
    as       = rf.context.network
    to       = rf.concept.subnet
    via      = source.subnet_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared subnet instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "vpn-gateway" {
  match {
    type = "aws_vpn_gateway"
  }

  as = concept.vpn-gateway

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }
}


rule "vpn-connection" {
  match {
    type = "aws_vpn_connection"
  }

  as = concept.vpn-connection

  context {
    as       = rf.context.network
    to       = concept.vpn-gateway
    via      = source.vpn_gateway_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  context {
    as       = rf.context.network
    to       = concept.transit-gateway
    via      = source.transit_gateway_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
