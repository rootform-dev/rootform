# Maintained directly from pinned provider evidence.
concept "network-security-group" {
  description = "An Azure Network Security Group containing stateful traffic rules."
}

concept "network-security-perimeter" {
  description = "An Azure Network Security Perimeter isolating platform services."
}

rule "application-security-group" {
  match {
    type = "azurerm_application_security_group"
  }

  as = concept.network-policy-detail
}

rule "ip-group" {
  match {
    type = "azurerm_ip_group"
  }

  as = concept.network-policy-detail
}

rule "network-security-group" {
  match {
    type = "azurerm_network_security_group"
  }

  as = concept.network-security-group

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

rule "network-security-perimeter" {
  match {
    type = "azurerm_network_security_perimeter"
  }

  as = concept.network-security-perimeter

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

rule "network-security-rule" {
  match {
    type = "azurerm_network_security_rule"
  }

  as = concept.network-policy-detail
}
