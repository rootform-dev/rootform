concept "workspace-network-configuration" {
  description = "A Databricks registration of customer-managed workspace network infrastructure."
}

concept "private-endpoint-registration" {
  description = "A Databricks registration of a cloud private connectivity endpoint."
}

concept "private-access-settings" {
  description = "Databricks private access settings controlling private workspace ingress."
}

concept "network-security-configuration" {
  description = "Network policy or access configuration supporting Databricks connectivity."
}

rule "workspace-network-configuration" {
  match {
    type = "databricks_mws_networks"
  }

  as = concept.workspace-network-configuration

  identity {
    attributes = ["id", "network_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "network_id"]
  }

  relation "uses-cloud-network" {
    to       = rf.concept.virtual-network
    via      = source.vpc_id
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-cloud-network" {
    to       = rf.concept.virtual-network
    via      = source.gcp_network_info[0].vpc_id
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "vpc-endpoint-registration" {
  match {
    type = "databricks_mws_vpc_endpoint"
  }

  as = concept.private-endpoint-registration

}

rule "service-direct-endpoint" {
  match {
    type = "databricks_endpoint"
  }

  as = concept.private-endpoint-registration

}

rule "private-access-settings" {
  match {
    type = "databricks_mws_private_access_settings"
  }

  as = concept.private-access-settings

  identity {
    attributes = ["id", "private_access_settings_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "private_access_settings_id"]
  }
}

rule "account-network-policy" {
  match {
    type = "databricks_account_network_policy"
  }

  as = concept.network-security-configuration
}

rule "ip-access-list" {
  match {
    type = "databricks_ip_access_list"
  }

  as = concept.network-security-configuration
}
