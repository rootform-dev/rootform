rule "rum-application" {
  match {
    type = "datadog_rum_application"
  }

  as = concept.browser-observability-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "rum-application-lookup" {
  match {
    kind = "data"
    type = "datadog_rum_application"
  }

  as = concept.browser-observability-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "rum-retention-filter" {
  match {
    type = "datadog_rum_retention_filter"
  }

  as = concept.telemetry-configuration

  contribution {
    to       = concept.browser-observability-application
    via      = source.application_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
