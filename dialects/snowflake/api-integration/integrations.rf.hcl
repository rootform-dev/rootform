concept "api-integration" {
  description = "A Snowflake API integration authorizing access to an external API proxy or repository."
}

concept "external-access-integration" {
  description = "A Snowflake external access integration governing outbound access from handler code or services."
}

concept "external-function" {
  description = "A Snowflake external function relaying execution through an HTTPS proxy service."
}

concept "git-repository" {
  description = "A Snowflake Git repository clone connected through an API integration."
}

rule "api-integration" {
  match {
    type = "snowflake_api_integration"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "amazon-api-gateway-integration" {
  match {
    type = "snowflake_api_integration_amazon_api_gateway"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "azure-api-management-integration" {
  match {
    type = "snowflake_api_integration_azure_api_management"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "google-cloud-api-gateway-integration" {
  match {
    type = "snowflake_api_integration_google_cloud_api_gateway"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

}

rule "external-mcp-dynamic-client-integration" {
  match {
    type = "snowflake_api_integration_external_mcp_dynamic_client"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "external-mcp-oauth2-integration" {
  match {
    type = "snowflake_api_integration_external_mcp_oauth2"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "github-app-repository-integration" {
  match {
    type = "snowflake_api_integration_git_repository_github_app"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "oauth2-repository-integration" {
  match {
    type = "snowflake_api_integration_git_repository_oauth2"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "private-link-repository-integration" {
  match {
    type = "snowflake_api_integration_git_repository_private_link"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "token-repository-integration" {
  match {
    type = "snowflake_api_integration_git_repository_token"
  }

  as = concept.api-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }
}

rule "external-access-integration" {
  match {
    type = "snowflake_external_access_integration"
  }

  as = concept.external-access-integration

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "uses-api-authentication-integration" {
    to       = concept.identity-integration
    via      = source.allowed_api_authentication_integrations[0].integrations[0]
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "external-function" {
  match {
    type = "snowflake_external_function"
  }

  as = concept.external-function

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-api-integration" {
    to       = concept.api-integration
    via      = source.api_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}

rule "git-repository" {
  match {
    type = "snowflake_git_repository"
  }

  as = concept.git-repository

  context {
    as       = context.ownership
    to       = concept.schema
    via      = source.schema
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }

  relation "uses-api-integration" {
    to       = concept.api-integration
    via      = source.api_integration
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.fully_qualified_name]
      strategy = "exact"
    }
  }
}
