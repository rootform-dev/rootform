concept "network-connectivity-configuration" {
  description = "A regional Databricks network connectivity configuration for serverless workloads."
}

concept "private-endpoint-rule" {
  description = "A Databricks rule provisioning private connectivity from serverless compute to a cloud resource."
}

concept "network-binding" {
  description = "A binding attaching Databricks serverless network configuration to a workspace."
}

rule "network-connectivity-configuration" {
  match {
    type = "databricks_mws_network_connectivity_config"
  }

  as = concept.network-connectivity-configuration

  identity {
    attributes = ["id", "network_connectivity_config_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "network_connectivity_config_id"]
  }
}

rule "network-connectivity-binding" {
  match {
    type = "databricks_mws_ncc_binding"
  }

  as = concept.network-binding

  contribution {
    to       = concept.network-connectivity-configuration
    via      = source.network_connectivity_config_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.network_connectivity_config_id
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.workspace
    via      = source.workspace_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.workspace_id
      strategy = "exact"
    }
  }
}

rule "private-endpoint-rule" {
  match {
    type = "databricks_mws_ncc_private_endpoint_rule"
  }

  as = concept.private-endpoint-rule

  context {
    as       = rf.context.network
    to       = concept.network-connectivity-configuration
    via      = source.network_connectivity_config_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.network_connectivity_config_id
      strategy = "exact"
    }
  }

  relation "connects-to-storage" {
    to       = rf.concept.object-storage-container
    via      = source.resource_id
    on_null  = "absent"
    on_empty = "absent"
  }

}
