concept "storage-integration" {
  description = "A Snowflake storage integration delegating access to external cloud object storage."
}

concept "external-volume" {
  description = "A Snowflake external volume containing one or more cloud storage locations."
}

concept "catalog-integration" {
  description = "A Snowflake catalog integration connecting Iceberg metadata to an external catalog."
}

rule "storage-integration" {
  match {
    type = "snowflake_storage_integration"
  }

  as = concept.storage-integration

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[0]
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[1]
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "aws-storage-integration" {
  match {
    type = "snowflake_storage_integration_aws"
  }

  as = concept.storage-integration

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[0]
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[1]
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "azure-storage-integration" {
  match {
    type = "snowflake_storage_integration_azure"
  }

  as = concept.storage-integration

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[0]
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[1]
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "gcs-storage-integration" {
  match {
    type = "snowflake_storage_integration_gcs"
  }

  as = concept.storage-integration

  identity {
    attributes = ["name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[0]
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "authorizes-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_allowed_locations[1]
    on_null  = "absent"
    on_empty = "absent"
  }
}

rule "external-volume" {
  match {
    type = "snowflake_external_volume"
  }

  as = concept.external-volume

  identity {
    attributes = ["id", "name", "fully_qualified_name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name", "fully_qualified_name"]
  }

  relation "uses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_location[0].storage_base_url
    on_null  = "absent"
    on_empty = "absent"
  }

  relation "uses-object-storage" {
    to       = rf.concept.object-storage-container
    via      = source.storage_location[1].storage_base_url
    on_null  = "absent"
    on_empty = "absent"
  }

}

rule "aws-glue-catalog-integration" {
  match {
    type = "snowflake_catalog_integration_aws_glue"
  }

  as = concept.catalog-integration

}

rule "iceberg-rest-catalog-integration" {
  match {
    type = "snowflake_catalog_integration_iceberg_rest"
  }

  as = concept.catalog-integration

}

rule "object-storage-catalog-integration" {
  match {
    type = "snowflake_catalog_integration_object_storage"
  }

  as = concept.catalog-integration
}

rule "open-catalog-integration" {
  match {
    type = "snowflake_catalog_integration_open_catalog"
  }

  as = concept.catalog-integration
}
