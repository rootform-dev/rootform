concept "spectrum-application" {
  description = "A Cloudflare Spectrum TCP or UDP application."
}

concept "waiting-room" {
  description = "A Cloudflare Waiting Room controlling application admission."
}

concept "email-routing-configuration" {
  description = "Cloudflare Email Routing configuration for a zone."
}

concept "waiting-room-configuration" {
  description = "An event, bypass rule, or setting supporting a Cloudflare Waiting Room."
}

concept "email-security-configuration" {
  description = "Trusted-domain, sender-blocking, or impersonation configuration for Cloudflare Email Security."
}

rule "spectrum-application" {
  match {
    type = "cloudflare_spectrum_application"
  }

  as = concept.spectrum-application

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

}

rule "waiting-room" {
  match {
    type = "cloudflare_waiting_room"
  }

  as = concept.waiting-room

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
}

rule "email-routing-settings" {
  match {
    type = "cloudflare_email_routing_settings"
  }

  as = concept.email-routing-configuration

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

rule "email-routing-rule" {
  match {
    type = "cloudflare_email_routing_rule"
  }

  as = concept.email-routing-configuration

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

rule "email-routing-catch-all" {
  match {
    type = "cloudflare_email_routing_catch_all"
  }

  as = concept.email-routing-configuration

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

rule "waiting-room-event" {
  match {
    type = "cloudflare_waiting_room_event"
  }

  as = concept.waiting-room-configuration

  contribution {
    to       = concept.waiting-room
    via      = source.waiting_room_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

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

rule "waiting-room-rules" {
  match {
    type = "cloudflare_waiting_room_rules"
  }

  as = concept.waiting-room-configuration

  contribution {
    to       = concept.waiting-room
    via      = source.waiting_room_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

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

rule "waiting-room-settings" {
  match {
    type = "cloudflare_waiting_room_settings"
  }

  as = concept.waiting-room-configuration

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

rule "email-security-block-sender" {
  match {
    type = "cloudflare_email_security_block_sender"
  }

  as = concept.email-security-configuration
}

rule "email-security-impersonation-registry" {
  match {
    type = "cloudflare_email_security_impersonation_registry"
  }

  as = concept.email-security-configuration
}

rule "email-security-trusted-domains" {
  match {
    type = "cloudflare_email_security_trusted_domains"
  }

  as = concept.email-security-configuration
}
