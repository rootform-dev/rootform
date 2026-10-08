concept "auth-configuration" {
  description = "A role, mapping, certificate, or setting supporting a Vault auth method."
}

concept "auth-method" {
  description = "A mounted Vault auth method verifying a human or machine identity."
}

concept "kubernetes-auth-integration" {
  description = "A Vault Kubernetes authentication integration connecting a mounted auth method to a Kubernetes cluster."
}

rule "alicloud-auth-backend-role" {
  match {
    type = "vault_alicloud_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "approle-auth-backend-role" {
  match {
    type = "vault_approle_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "auth-backend" {
  match {
    type = "vault_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "aws-auth-backend-cert" {
  match {
    type = "vault_aws_auth_backend_cert"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "aws-auth-backend-client" {
  match {
    type = "vault_aws_auth_backend_client"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "aws-auth-backend-config-identity" {
  match {
    type = "vault_aws_auth_backend_config_identity"
  }

  as = concept.auth-configuration
}

rule "aws-auth-backend-identity-whitelist" {
  match {
    type = "vault_aws_auth_backend_identity_whitelist"
  }

  as = concept.auth-configuration
}

rule "aws-auth-backend-role" {
  match {
    type = "vault_aws_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "aws-auth-backend-role-tag" {
  match {
    type = "vault_aws_auth_backend_role_tag"
  }

  as = concept.auth-configuration
}

rule "aws-auth-backend-roletag-blacklist" {
  match {
    type = "vault_aws_auth_backend_roletag_blacklist"
  }

  as = concept.auth-configuration
}

rule "aws-auth-backend-sts-role" {
  match {
    type = "vault_aws_auth_backend_sts_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "azure-auth-backend-config" {
  match {
    type = "vault_azure_auth_backend_config"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "azure-auth-backend-role" {
  match {
    type = "vault_azure_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "cert-auth-backend-role" {
  match {
    type = "vault_cert_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "cf-auth-backend-config" {
  match {
    type = "vault_cf_auth_backend_config"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "cf-auth-backend-role" {
  match {
    type = "vault_cf_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "gcp-auth-backend" {
  match {
    type = "vault_gcp_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-cloud-identity" {
    to       = rf.concept.service-identity
    via      = source.service_account_email
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "gcp-auth-backend-role" {
  match {
    type = "vault_gcp_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "github-auth-backend" {
  match {
    type = "vault_github_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "github-team" {
  match {
    type = "vault_github_team"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "jwt-auth-backend" {
  match {
    type = "vault_jwt_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "jwt-auth-backend-role" {
  match {
    type = "vault_jwt_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "kerberos-auth-backend-config" {
  match {
    type = "vault_kerberos_auth_backend_config"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "kerberos-auth-backend-group" {
  match {
    type = "vault_kerberos_auth_backend_group"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "kerberos-auth-backend-ldap-config" {
  match {
    type = "vault_kerberos_auth_backend_ldap_config"
  }

  as = concept.auth-configuration
}

rule "kubernetes-auth-backend-config" {
  match {
    type = "vault_kubernetes_auth_backend_config"
  }

  as = concept.kubernetes-auth-integration

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "authenticates-kubernetes-cluster" {
    to       = rf.concept.kubernetes-cluster
    via      = source.kubernetes_host
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "configures-auth-method" {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "kubernetes-auth-backend-role" {
  match {
    type = "vault_kubernetes_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "ldap-auth-backend" {
  match {
    type = "vault_ldap_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "ldap-auth-backend-group" {
  match {
    type = "vault_ldap_auth_backend_group"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "oci-auth-backend" {
  match {
    type = "vault_oci_auth_backend"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.path
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "oci-auth-backend-role" {
  match {
    type = "vault_oci_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "okta-auth-backend" {
  match {
    type = "vault_okta_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "okta-auth-backend-group" {
  match {
    type = "vault_okta_auth_backend_group"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.path
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "radius-auth-backend" {
  match {
    type = "vault_radius_auth_backend"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "saml-auth-backend" {
  match {
    type = "vault_saml_auth_backend"
  }

  as = concept.auth-method

  identity {
    attributes = ["path"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "path"]
  }

  context {
    as       = context.ownership
    to       = concept.namespace
    via      = source.namespace
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }

    # Shared namespace instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "saml-auth-backend-role" {
  match {
    type = "vault_saml_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.path
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "scep-auth-backend-role" {
  match {
    type = "vault_scep_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.backend
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "spiffe-auth-backend-config" {
  match {
    type = "vault_spiffe_auth_backend_config"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "spiffe-auth-backend-role" {
  match {
    type = "vault_spiffe_auth_backend_role"
  }

  as = concept.auth-configuration

  contribution {
    to       = concept.auth-method
    via      = source.mount
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.path
      strategy = "exact"
    }
  }
}

rule "token-auth-backend-role" {
  match {
    type = "vault_token_auth_backend_role"
  }

  as = concept.auth-configuration
}
