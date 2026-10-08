concept "origin-pool" {
  description = "A Cloudflare Load Balancing pool grouping origin endpoints."
}

concept "load-balancer-monitoring" {
  description = "Health monitoring configuration supporting Cloudflare Load Balancing."
}

rule "load-balancer" {
  match {
    type = "cloudflare_load_balancer"
  }

  as = concept.load-balancer

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
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

  relation "uses-origin-pool" {
    to       = concept.origin-pool
    via      = source.default_pools
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "uses-origin-pool" {
    to       = concept.origin-pool
    via      = source.fallback_pool
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "load-balancer-pool" {
  match {
    type = "cloudflare_load_balancer_pool"
  }

  as = concept.origin-pool

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

}

rule "load-balancer-monitor" {
  match {
    type = "cloudflare_load_balancer_monitor"
  }

  as = concept.load-balancer-monitoring
}
rule "load-balancer-monitor-group" {
  match {
    type = "cloudflare_load_balancer_monitor_group"
  }

  as = concept.load-balancer-monitoring
}

rule "healthcheck" {
  match {
    type = "cloudflare_healthcheck"
  }

  as = concept.load-balancer-monitoring
}
