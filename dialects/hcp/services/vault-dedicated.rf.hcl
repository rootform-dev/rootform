concept "vault-dedicated-cluster" {
  description = "A HashiCorp-managed Vault Dedicated cluster on HCP."
}

concept "vault-plugin" {
  description = "A custom plugin installed into an HCP Vault Dedicated cluster."
}

rule "vault-cluster" {
  match {
    type = "hcp_vault_cluster"
  }

  as = concept.vault-dedicated-cluster

  identity {
    attributes = ["id", "cluster_id", "self_link", "vault_public_endpoint_url"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "cluster_id", "self_link", "vault_public_endpoint_url", "vault_private_endpoint_url"]
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

  relation "replicates-from" {
    to       = concept.vault-dedicated-cluster
    via      = source.primary_link
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.self_link
      strategy = "exact"
    }
  }
}

rule "vault-cluster-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_cluster"
  }

  as = concept.vault-dedicated-cluster

  identity {
    attributes = ["id", "cluster_id", "self_link", "vault_public_endpoint_url"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "cluster_id", "self_link", "vault_public_endpoint_url", "vault_private_endpoint_url"]
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

  relation "replicates-from" {
    to       = concept.vault-dedicated-cluster
    via      = source.primary_link
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.self_link
      strategy = "exact"
    }
  }
}

rule "vault-plugin" {
  match {
    type = "hcp_vault_plugin"
  }

  as = concept.vault-plugin

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

  relation "extends-cluster" {
    to       = concept.vault-dedicated-cluster
    via      = source.cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.cluster_id
      strategy = "exact"
    }
  }
}

rule "vault-plugin-lookup" {
  match {
    kind = "data"
    type = "hcp_vault_plugin"
  }

  as = concept.vault-plugin

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

  relation "extends-cluster" {
    to       = concept.vault-dedicated-cluster
    via      = source.cluster_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.cluster_id
      strategy = "exact"
    }
  }
}
