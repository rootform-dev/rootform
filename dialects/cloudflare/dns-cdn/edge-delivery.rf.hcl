concept "edge-delivery-configuration" {
  description = "Cache, routing, transformation, or delivery configuration applied at the Cloudflare edge."
}

rule "argo-smart-routing" {
  match {
    type = "cloudflare_argo_smart_routing"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "argo-tiered-caching" {
  match {
    type = "cloudflare_argo_tiered_caching"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "tiered-cache" {
  match {
    type = "cloudflare_tiered_cache"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "regional-tiered-cache" {
  match {
    type = "cloudflare_regional_tiered_cache"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "zone-cache-reserve" {
  match {
    type = "cloudflare_zone_cache_reserve"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "zone-cache-variants" {
  match {
    type = "cloudflare_zone_cache_variants"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "managed-transforms" {
  match {
    type = "cloudflare_managed_transforms"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "url-normalization-settings" {
  match {
    type = "cloudflare_url_normalization_settings"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "page-rule" {
  match {
    type = "cloudflare_page_rule"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "google-tag-gateway" {
  match {
    type = "cloudflare_google_tag_gateway"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "origin-cloud-region" {
  match {
    type = "cloudflare_origin_cloud_region"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "snippet" {
  match {
    type = "cloudflare_snippet"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "snippets" {
  match {
    type = "cloudflare_snippets"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}

rule "snippet-rules" {
  match {
    type = "cloudflare_snippet_rules"
  }

  as = concept.edge-delivery-configuration

  contribution {
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
}
