# Maintained directly from pinned provider evidence.
concept "azure-firewall" {
  description = "An Azure Firewall managed network security service."
}

concept "firewall-policy" {
  description = "An Azure Firewall or web application firewall policy."
}

concept "web-application-firewall-policy" {
  description = "A reusable Azure Web Application Firewall policy applied to Application Gateway traffic."
}

rule "azure-firewall" {
  match {
    type = "azurerm_firewall"
  }

  as = concept.azure-firewall

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

rule "azure-firewall-policy" {
  match {
    type = "azurerm_firewall_policy"
  }

  as = concept.firewall-policy
}

rule "azure-firewall-policy-rule-collection-group" {
  match {
    type = "azurerm_firewall_policy_rule_collection_group"
  }

  as = concept.firewall-policy
}

rule "web-application-firewall-policy" {
  match {
    type = "azurerm_web_application_firewall_policy"
  }

  as = concept.web-application-firewall-policy

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
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
