concept "cloud-dns-record-set" {
  description = "A DNS record set managed inside a Cloud DNS managed zone."
}

rule "cloud-dns-managed-zone" {
  match {
    type = "google_dns_managed_zone"
  }

  as = concept.dns-zone

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "cloud-dns-record-set" {
  match {
    type = "google_dns_record_set"
  }

  as = concept.cloud-dns-record-set

  contribution {
    to  = concept.dns-zone
    via = source.managed_zone

    on_null  = "absent"
    on_empty = "absent"

    # Shared dns-zone instances can be provisioned by a separate configuration.
    external = "allow"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
