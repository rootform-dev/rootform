concept "edge-security-configuration" {
  description = "WAF, API, bot, content, credential, or certificate protection applied at the Cloudflare edge."
}



rule "ruleset" {
  match {
    type = "cloudflare_ruleset"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "firewall-rule" {
  match {
    type = "cloudflare_firewall_rule"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "rate-limit" {
  match {
    type = "cloudflare_rate_limit"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield" {
  match {
    type = "cloudflare_api_shield"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "bot-management" {
  match {
    type = "cloudflare_bot_management"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "page-shield-policy" {
  match {
    type = "cloudflare_page_shield_policy"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "content-scanning" {
  match {
    type = "cloudflare_content_scanning"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "token-validation-config" {
  match {
    type = "cloudflare_token_validation_config"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}



rule "precursor" {
  match {
    type = "cloudflare_precursor"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield-discovery-operation" {
  match {
    type = "cloudflare_api_shield_discovery_operation"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield-operation" {
  match {
    type = "cloudflare_api_shield_operation"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield-operation-schema-validation" {
  match {
    type = "cloudflare_api_shield_operation_schema_validation_settings"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield-schema" {
  match {
    type = "cloudflare_api_shield_schema"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "api-shield-schema-validation" {
  match {
    type = "cloudflare_api_shield_schema_validation_settings"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "schema-validation-operation-settings" {
  match {
    type = "cloudflare_schema_validation_operation_settings"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "schema-validation-schemas" {
  match {
    type = "cloudflare_schema_validation_schemas"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "schema-validation-settings" {
  match {
    type = "cloudflare_schema_validation_settings"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "content-scanning-expression" {
  match {
    type = "cloudflare_content_scanning_expression"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "user-agent-blocking-rule" {
  match {
    type = "cloudflare_user_agent_blocking_rule"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "zone-lockdown" {
  match {
    type = "cloudflare_zone_lockdown"
  }

  as = concept.edge-security-configuration

  contribution {
    to       = concept.dns-zone
    via      = source.zone_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
