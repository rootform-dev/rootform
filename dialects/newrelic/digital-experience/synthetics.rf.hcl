rule "synthetics-broken-links-monitor" {
  match {
    type = "newrelic_synthetics_broken_links_monitor"
  }

  as = concept.synthetic-check

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

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.locations_private
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.guid, target.id]
      strategy = "exact"
    }
  }
}

rule "synthetics-cert-check-monitor" {
  match {
    type = "newrelic_synthetics_cert_check_monitor"
  }

  as = concept.synthetic-check

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

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.locations_private
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.guid, target.id]
      strategy = "exact"
    }
  }
}

rule "synthetics-monitor" {
  match {
    type = "newrelic_synthetics_monitor"
  }

  as = concept.synthetic-check

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

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.locations_private
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.guid, target.id]
      strategy = "exact"
    }
  }
}

rule "synthetics-private-location" {
  match {
    type = "newrelic_synthetics_private_location"
  }

  as = concept.synthetic-execution-location

  identity {
    attributes = ["id", "guid"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "guid"]
  }

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

rule "synthetics-private-location-lookup" {
  match {
    kind = "data"
    type = "newrelic_synthetics_private_location"
  }

  as = concept.synthetic-execution-location

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.observability-tenant
    via      = source.account_id
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

rule "synthetics-script-monitor" {
  match {
    type = "newrelic_synthetics_script_monitor"
  }

  as = concept.synthetic-check

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

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.location_private[0].guid
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.guid, target.id]
      strategy = "exact"
    }
  }
}

rule "synthetics-step-monitor" {
  match {
    type = "newrelic_synthetics_step_monitor"
  }

  as = concept.synthetic-check

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

  contribution {
    to       = concept.synthetic-execution-location
    via      = source.location_private[0].guid
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.guid, target.id]
      strategy = "exact"
    }
  }
}
