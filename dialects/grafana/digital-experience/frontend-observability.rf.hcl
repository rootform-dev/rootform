rule "frontend-o11y-app" {
  match {
    type = "grafana_frontend_o11y_app"
  }

  as = concept.browser-observability-application

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "frontend-o11y-app-lookup" {
  match {
    kind = "data"
    type = "grafana_frontend_o11y_app"
  }

  as = concept.browser-observability-application

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
