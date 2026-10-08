concept "vpc-firewall-rule" {
  description = "A Google Cloud VPC firewall rule controlling network traffic."
}

concept "firewall-policy" {
  description = "A Google Cloud hierarchical or network firewall policy."
}

concept "firewall-policy-rule" {
  description = "A rule contributing controls to a Google Cloud firewall policy."
}

rule "vpc-firewall-rule" {
  match {
    type = "google_compute_firewall"
  }

  as = concept.vpc-firewall-rule

  context {
    as       = rf.context.network
    to       = rf.concept.virtual-network
    via      = source.network
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.self_link, target.name]
      strategy = "exact"
    }

    # Shared virtual-network instances can be provisioned by a separate configuration.
    external = "allow"
  }

  context {
    as       = context.ownership
    to       = concept.google-cloud-project
    via      = source.project
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.project_id
      strategy = "exact"
    }

    # Shared google-cloud-project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "hierarchical-firewall-policy" {
  match {
    type = "google_compute_firewall_policy"
  }

  as = concept.firewall-policy

  identity {
    attributes = ["id", "self_link", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link", "name"]
  }
}

rule "hierarchical-firewall-policy-rule" {
  match {
    type = "google_compute_firewall_policy_rule"
  }

  as = concept.firewall-policy-rule

  contribution {
    to       = concept.firewall-policy
    via      = source.firewall_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.id, target.name, target.self_link]
      strategy = "exact"
    }
  }
}

rule "network-firewall-policy" {
  match {
    type = "google_compute_network_firewall_policy"
  }

  as = concept.firewall-policy

  identity {
    attributes = ["id", "self_link", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link", "name"]
  }
}

rule "network-firewall-policy-rule" {
  match {
    type = "google_compute_network_firewall_policy_rule"
  }

  as = concept.firewall-policy-rule

  contribution {
    to       = concept.firewall-policy
    via      = source.firewall_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id, target.self_link]
      strategy = "exact"
    }
  }
}
