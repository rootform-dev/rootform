# Maintained directly from pinned provider evidence.
concept "image-gallery" {
  description = "An Azure Compute Gallery owning image definitions and versions."
}

rule "compute-gallery" {
  match {
    type = "azurerm_shared_image_gallery"
  }

  as = concept.image-gallery

  context {
    as       = context.ownership
    to       = concept.resource-group
    via      = source.resource_group_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared resource-group instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
