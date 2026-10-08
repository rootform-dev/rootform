# Maintained directly from pinned provider evidence.
concept "dns-record" {
  description = "A DNS record inside an Azure DNS zone."
}

concept "private-dns-resolver" {
  description = "An Azure DNS Private Resolver forwarding DNS between networks."
}

concept "private-network-link" {
  description = "An Azure Private DNS virtual network link."
}

rule "dns-a-record" {
  match {
    type = "azurerm_dns_a_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-aaaa-record" {
  match {
    type = "azurerm_dns_aaaa_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-cname-record" {
  match {
    type = "azurerm_dns_cname_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-mx-record" {
  match {
    type = "azurerm_dns_mx_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-ns-record" {
  match {
    type = "azurerm_dns_ns_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-ptr-record" {
  match {
    type = "azurerm_dns_ptr_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-srv-record" {
  match {
    type = "azurerm_dns_srv_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-txt-record" {
  match {
    type = "azurerm_dns_txt_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.zone_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-zone" {
  match {
    type = "azurerm_dns_zone"
  }

  as = concept.dns-zone

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "private-dns-a-record" {
  match {
    type = "azurerm_private_dns_a_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "private-dns-cname-record" {
  match {
    type = "azurerm_private_dns_cname_record"
  }

  as = concept.dns-record

  context {
    as       = context.ownership
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }

  contribution {
    to       = concept.dns-zone
    via      = source.private_dns_zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "private-dns-forwarding-ruleset" {
  match {
    type = "azurerm_private_dns_resolver_dns_forwarding_ruleset"
  }

  as = concept.private-network-link
}

rule "private-dns-inbound-endpoint" {
  match {
    type = "azurerm_private_dns_resolver_inbound_endpoint"
  }

  as = concept.private-network-link
}

rule "private-dns-outbound-endpoint" {
  match {
    type = "azurerm_private_dns_resolver_outbound_endpoint"
  }

  as = concept.private-network-link
}

rule "private-dns-resolver" {
  match {
    type = "azurerm_private_dns_resolver"
  }

  as = concept.private-dns-resolver

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
