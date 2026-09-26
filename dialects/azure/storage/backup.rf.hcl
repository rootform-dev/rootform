# Maintained directly from pinned provider evidence.
rule "data-protection-backup-vault" {
  match {
    type = "azurerm_data_protection_backup_vault"
  }

  as = concept.backup-vault

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

rule "data-protection-blob-backup-policy" {
  match {
    type = "azurerm_data_protection_backup_policy_blob_storage"
  }

  as = concept.backup-plan
}

rule "data-protection-disk-backup-policy" {
  match {
    type = "azurerm_data_protection_backup_policy_disk"
  }

  as = concept.backup-plan
}

rule "netapp-backup-policy" {
  match {
    type = "azurerm_netapp_backup_policy"
  }

  as = concept.backup-plan

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

rule "netapp-backup-vault" {
  match {
    type = "azurerm_netapp_backup_vault"
  }

  as = concept.backup-vault

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
