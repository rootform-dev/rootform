rule "synthetic-monitoring-check" {
  match {
    type = "grafana_synthetic_monitoring_check"
  }

  as = concept.synthetic-check

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.probes
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "synthetic-monitoring-probe" {
  match {
    type = "grafana_synthetic_monitoring_probe"
  }

  as = concept.synthetic-execution-location

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "synthetic-monitoring-probe-lookup" {
  match {
    kind = "data"
    type = "grafana_synthetic_monitoring_probe"
  }

  as = concept.synthetic-execution-location

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
