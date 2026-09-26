concept "identity-integration" {
  description = "A Snowflake identity or authentication integration with an external identity system."
}


concept "network-policy" {
  description = "A Snowflake network policy controlling inbound account access."
}

concept "security-configuration" {
  description = "A Snowflake security rule or database role supporting an access boundary."
}

rule "service-user" {
  match {
    type = "snowflake_service_user"
  }

  as = rf.concept.service-identity

  relation "uses-network-policy" {
    to       = concept.network-policy
    via      = source.network_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-default-warehouse" {
    to       = concept.virtual-warehouse
    via      = source.default_warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "legacy-service-user" {
  match {
    type = "snowflake_legacy_service_user"
  }

  as = rf.concept.service-identity

  relation "uses-network-policy" {
    to       = concept.network-policy
    via      = source.network_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-default-warehouse" {
    to       = concept.virtual-warehouse
    via      = source.default_warehouse
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}


rule "database-role" {
  match {
    type = "snowflake_database_role"
  }

  as = concept.security-configuration

  contribution {
    to       = concept.database
    via      = source.database
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "network-policy" {
  match {
    type = "snowflake_network_policy"
  }

  as = concept.network-policy

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "network-rule" {
  match {
    type = "snowflake_network_rule"
  }

  as = concept.security-configuration

  contribution {
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "saml2-integration" {
  match {
    type = "snowflake_saml2_integration"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "scim-integration" {
  match {
    type = "snowflake_scim_integration"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "uses-network-policy" {
    to       = concept.network-policy
    via      = source.network_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "external-oauth-integration" {
  match {
    type = "snowflake_external_oauth_integration"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "custom-client-oauth-integration" {
  match {
    type = "snowflake_oauth_integration_for_custom_clients"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "uses-network-policy" {
    to       = concept.network-policy
    via      = source.network_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "partner-application-oauth-integration" {
  match {
    type = "snowflake_oauth_integration_for_partner_applications"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "authorization-code-api-authentication" {
  match {
    type = "snowflake_api_authentication_integration_with_authorization_code_grant"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "client-credentials-api-authentication" {
  match {
    type = "snowflake_api_authentication_integration_with_client_credentials"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "jwt-bearer-api-authentication" {
  match {
    type = "snowflake_api_authentication_integration_with_jwt_bearer"
  }

  as = concept.identity-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}
