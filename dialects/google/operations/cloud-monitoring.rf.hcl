concept "cloud-monitoring-alerting-policy" {
  description = "A Cloud Monitoring alerting policy defining conditions and notification behavior."
}

concept "cloud-monitoring-service" {
  description = "A Cloud Monitoring service used as the target of service-level objectives."
}

concept "cloud-monitoring-slo" {
  description = "A service-level objective contributing reliability intent to a monitored service."
}

rule "cloud-monitoring-alerting-policy" {
  match {
    type = "google_monitoring_alert_policy"
  }

  as = concept.cloud-monitoring-alerting-policy

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

rule "cloud-monitoring-service" {
  match {
    type = "google_monitoring_service"
  }

  as = concept.cloud-monitoring-service

  identity {
    attributes = ["name", "service_id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "service_id"]
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

rule "cloud-monitoring-slo" {
  match {
    type = "google_monitoring_slo"
  }

  as = concept.cloud-monitoring-slo

  contribution {
    to       = concept.cloud-monitoring-service
    via      = source.service
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.service_id, target.name]
      strategy = "exact"
    }
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
