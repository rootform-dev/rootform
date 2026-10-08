concept "identity-provider" {
  description = "An OpenID Connect identity provider trusted by Confluent Cloud."
}

concept "identity-pool" {
  description = "A Confluent Cloud identity pool mapping external identities to access."
}

concept "identity-access-configuration" {
  description = "Identity mapping, role binding, or access configuration in Confluent Cloud."
}

rule "service-account" {
  match {
    type = "confluent_service_account"
  }

  as = rf.concept.service-identity

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "identity-provider" {
  match {
    type = "confluent_identity_provider"
  }

  as = concept.identity-provider

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "identity-pool" {
  match {
    type = "confluent_identity_pool"
  }

  as = concept.identity-pool

  relation "trusts" {
    to       = concept.identity-provider
    via      = source.identity_provider[0].id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "group-mapping" {
  match {
    type = "confluent_group_mapping"
  }

  as = concept.identity-access-configuration
}

rule "role-binding" {
  match {
    type = "confluent_role_binding"
  }

  as = concept.identity-access-configuration
}

rule "ip-group" {
  match {
    type = "confluent_ip_group"
  }

  as = concept.identity-access-configuration
}

rule "ip-filter" {
  match {
    type = "confluent_ip_filter"
  }

  as = concept.identity-access-configuration
}
