concept "packer-artifact" {
  description = "An HCP Packer record locating a built machine image on an external platform."
}

concept "packer-bucket" {
  description = "An HCP Packer registry boundary grouping machine-image metadata."
}

concept "packer-channel" {
  description = "A named HCP Packer release channel selecting an image version."
}

concept "packer-configuration" {
  description = "An assignment or access setting supporting HCP Packer registry architecture."
}

concept "packer-version" {
  description = "A version of machine-image metadata in HCP Packer."
}

rule "packer-artifact-lookup" {
  match {
    kind = "data"
    type = "hcp_packer_artifact"
  }

  as = concept.packer-artifact

  context {
    as       = context.ownership
    to       = concept.packer-bucket
    via      = source.bucket_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "belongs-to-version" {
    to       = concept.packer-version
    via      = source.version_fingerprint
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.fingerprint
      strategy = "exact"
    }
  }
}

rule "packer-bucket" {
  match {
    type = "hcp_packer_bucket"
  }

  as = concept.packer-bucket

  identity {
    attributes = ["name", "resource_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["name", "resource_name"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "packer-bucket-iam-binding" {
  match {
    type = "hcp_packer_bucket_iam_binding"
  }

  as = concept.packer-configuration

  contribution {
    to       = concept.packer-bucket
    via      = source.resource_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "packer-bucket-iam-policy" {
  match {
    type = "hcp_packer_bucket_iam_policy"
  }

  as = concept.packer-configuration

  contribution {
    to       = concept.packer-bucket
    via      = source.resource_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_name
      strategy = "exact"
    }
  }
}

rule "packer-channel" {
  match {
    type = "hcp_packer_channel"
  }

  as = concept.packer-channel

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }

  context {
    as       = context.ownership
    to       = concept.packer-bucket
    via      = source.bucket_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "packer-channel-assignment" {
  match {
    type = "hcp_packer_channel_assignment"
  }

  as = concept.packer-configuration

  contribution {
    to       = concept.packer-channel
    via      = source.channel_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  contribution {
    to       = concept.packer-version
    via      = source.version_fingerprint
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.fingerprint
      strategy = "exact"
    }
  }
}

rule "packer-version-lookup" {
  match {
    kind = "data"
    type = "hcp_packer_version"
  }

  as = concept.packer-version

  identity {
    attributes = ["id", "fingerprint"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "fingerprint"]
  }

  context {
    as       = context.ownership
    to       = concept.packer-bucket
    via      = source.bucket_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }

  relation "selected-by-channel" {
    to       = concept.packer-channel
    via      = source.channel_name
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
