concept "dns-forwarding" {
  description = "A private DNS forwarding boundary associated with an HVN connection."
}

rule "dns-forwarding" {
  match {
    type = "hcp_dns_forwarding"
  }

  as = concept.dns-forwarding

  identity {
    attributes = ["id", "dns_forwarding_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "dns_forwarding_id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-forwarding-lookup" {
  match {
    kind = "data"
    type = "hcp_dns_forwarding"
  }

  as = concept.dns-forwarding

  identity {
    attributes = ["id", "dns_forwarding_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "dns_forwarding_id"]
  }

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.hvn_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.hvn_id
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "dns-forwarding-rule" {
  match {
    type = "hcp_dns_forwarding_rule"
  }

  as = concept.network-configuration

  contribution {
    to       = concept.dns-forwarding
    via      = source.dns_forwarding_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.dns_forwarding_id
      strategy = "exact"
    }
  }
}

rule "dns-forwarding-rule-lookup" {
  match {
    kind = "data"
    type = "hcp_dns_forwarding_rule"
  }

  as = concept.network-configuration

  contribution {
    to       = concept.dns-forwarding
    via      = source.dns_forwarding_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.dns_forwarding_id
      strategy = "exact"
    }
  }
}
