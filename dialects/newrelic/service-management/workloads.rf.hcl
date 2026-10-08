concept "observability-workload" {
  description = "A New Relic operational view grouping related observed entities for health and incident triage."
}

rule "workload" {
  match {
    type = "newrelic_workload"
  }

  as = concept.observability-workload

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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
