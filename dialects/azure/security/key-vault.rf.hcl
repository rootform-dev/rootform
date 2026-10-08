# Maintained directly from pinned provider evidence.
concept "key-vault" {
  description = "An Azure Key Vault security boundary for keys, secrets, and certificates."
}

rule "key-vault" {
  match {
    type = "azurerm_key_vault"
  }

  as = concept.key-vault

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

rule "key-vault-access-policy" {
  match {
    type = "azurerm_key_vault_access_policy"
  }

  as = concept.security-detail

  contribution {
    to       = concept.key-vault
    via      = source.key_vault_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared key-vault instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "key-vault-certificate" {
  match {
    type = "azurerm_key_vault_certificate"
  }

  as = concept.security-detail

  contribution {
    to       = concept.key-vault
    via      = source.key_vault_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared key-vault instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "key-vault-key" {
  match {
    type = "azurerm_key_vault_key"
  }

  as = concept.encryption-key

  context {
    as       = context.ownership
    to       = concept.key-vault
    via      = source.key_vault_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared key-vault instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "key-vault-secret" {
  match {
    type = "azurerm_key_vault_secret"
  }

  as = concept.managed-secret

  context {
    as       = context.ownership
    to       = concept.key-vault
    via      = source.key_vault_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared key-vault instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "managed-hsm" {
  match {
    type = "azurerm_key_vault_managed_hardware_security_module"
  }

  as = concept.managed-hsm

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

rule "managed-hsm-key" {
  match {
    type = "azurerm_key_vault_managed_hardware_security_module_key"
  }

  as = concept.encryption-key

  context {
    as       = context.ownership
    to       = concept.managed-hsm
    via      = source.managed_hsm_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
