concept "workspace" {
  description = "A Databricks workspace providing an isolated environment for data, analytics, and AI workloads."
}

concept "workspace-root-storage" {
  description = "A cloud storage registration used as root storage by Databricks workspaces."
}

concept "workspace-deployment-credential" {
  description = "A cloud identity registration used to deploy Databricks workspace resources."
}

concept "log-delivery" {
  description = "A Databricks account or workspace log-delivery configuration."
}


concept "workspace-configuration" {
  description = "Configuration, assignment, or setting supporting a Databricks workspace."
}

rule "workspace" {
  match {
    type = "databricks_mws_workspaces"
  }

  as = concept.workspace

  identity {
    attributes = ["id", "workspace_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "workspace_id"]
  }

  relation "uses-network" {
    to       = concept.workspace-network-configuration
    via      = source.network_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.network_id
      strategy = "exact"
    }
  }

  relation "uses-root-storage" {
    to       = concept.workspace-root-storage
    via      = source.storage_configuration_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.storage_configuration_id
      strategy = "exact"
    }
  }

  relation "uses-deployment-credential" {
    to       = concept.workspace-deployment-credential
    via      = source.credentials_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.credentials_id
      strategy = "exact"
    }
  }

  relation "uses-private-access" {
    to       = concept.private-access-settings
    via      = source.private_access_settings_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.private_access_settings_id
      strategy = "exact"
    }
  }

  relation "uses-serverless-network" {
    to       = concept.network-connectivity-configuration
    via      = source.network_connectivity_config_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.network_connectivity_config_id
      strategy = "exact"
    }
  }
}

rule "workspace-deployment-credential" {
  match {
    type = "databricks_mws_credentials"
  }

  as = concept.workspace-deployment-credential

  identity {
    attributes = ["id", "credentials_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "credentials_id"]
  }

}

rule "workspace-root-storage" {
  match {
    type = "databricks_mws_storage_configurations"
  }

  as = concept.workspace-root-storage

  identity {
    attributes = ["id", "storage_configuration_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "storage_configuration_id"]
  }

  relation "stores-in" {
    to       = rf.concept.object-storage-container
    via      = source.bucket_name
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "log-delivery" {
  match {
    type = "databricks_mws_log_delivery"
  }

  as = concept.log-delivery

  relation "delivers-to" {
    to       = concept.workspace-root-storage
    via      = source.storage_configuration_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.storage_configuration_id
      strategy = "exact"
    }
  }

  relation "uses-deployment-credential" {
    to       = concept.workspace-deployment-credential
    via      = source.credentials_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.credentials_id
      strategy = "exact"
    }
  }
}


rule "disaster-recovery-stable-url" {
  match {
    type = "databricks_disaster_recovery_stable_url"
  }

  as = concept.workspace-configuration
}

rule "workspace-configuration" {
  match {
    type = "databricks_workspace_conf"
  }

  as = concept.workspace-configuration
}

rule "workspace-setting" {
  match {
    type = "databricks_workspace_setting_v2"
  }

  as = concept.workspace-configuration
}

rule "account-setting" {
  match {
    type = "databricks_account_setting_v2"
  }

  as = concept.workspace-configuration
}

rule "workspace-network-option" {
  match {
    type = "databricks_workspace_network_option"
  }

  as = concept.workspace-configuration
}

rule "default-namespace-setting" {
  match {
    type = "databricks_default_namespace_setting"
  }

  as = concept.workspace-configuration
}

rule "disable-legacy-access-setting" {
  match {
    type = "databricks_disable_legacy_access_setting"
  }

  as = concept.workspace-configuration
}

rule "disable-legacy-dbfs-setting" {
  match {
    type = "databricks_disable_legacy_dbfs_setting"
  }

  as = concept.workspace-configuration
}

rule "disable-legacy-features-setting" {
  match {
    type = "databricks_disable_legacy_features_setting"
  }

  as = concept.workspace-configuration
}

rule "automatic-cluster-update-setting" {
  match {
    type = "databricks_automatic_cluster_update_workspace_setting"
  }

  as = concept.workspace-configuration
}

rule "compliance-security-profile-setting" {
  match {
    type = "databricks_compliance_security_profile_workspace_setting"
  }

  as = concept.workspace-configuration
}

rule "enhanced-security-monitoring-setting" {
  match {
    type = "databricks_enhanced_security_monitoring_workspace_setting"
  }

  as = concept.workspace-configuration
}

rule "restrict-workspace-admins-setting" {
  match {
    type = "databricks_restrict_workspace_admins_setting"
  }

  as = concept.workspace-configuration
}

rule "workspace-binding" {
  match {
    type = "databricks_workspace_binding"
  }

  as = concept.workspace-configuration
}

rule "warehouses-default-warehouse-override" {
  match {
    type = "databricks_warehouses_default_warehouse_override"
  }

  as = concept.workspace-configuration
}
