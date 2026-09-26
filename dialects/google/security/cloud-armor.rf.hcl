concept "cloud-armor-security-policy" {
  description = "A Cloud Armor security policy protecting load-balanced applications."
}

concept "cloud-armor-security-rule" {
  description = "A rule contributing traffic controls to a Cloud Armor security policy."
}

rule "cloud-armor-security-policy" {
  match {
    type = "google_compute_security_policy"
  }

  as = concept.cloud-armor-security-policy

  identity {
    attributes = ["id", "self_link", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "self_link", "name"]
  }
}

rule "cloud-armor-security-rule" {
  match {
    type = "google_compute_security_policy_rule"
  }

  as = concept.cloud-armor-security-rule

  contribution {
    to       = concept.cloud-armor-security-policy
    via      = source.security_policy
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id, target.self_link]
      strategy = "exact"
    }
  }
}
