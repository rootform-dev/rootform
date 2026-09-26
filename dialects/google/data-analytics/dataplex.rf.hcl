concept "dataplex-lake" {
  description = "A Dataplex lake organizing governed data domains."
}

concept "dataplex-zone" {
  description = "A Dataplex zone organizing assets within a lake."
}

concept "dataplex-asset" {
  description = "A data asset governed through Dataplex."
}


rule "dataplex-lake" {
  match {
    type = "google_dataplex_lake"
  }

  as = concept.dataplex-lake

  identity {
    attributes = ["id", "name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "dataplex-zone" {
  match {
    type = "google_dataplex_zone"
  }

  as = concept.dataplex-zone

  context {
    as       = context.ownership
    to       = concept.dataplex-lake
    via      = source.lake
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = [target.name, target.id]
      strategy = "exact"
    }
  }
}

rule "dataplex-asset" {
  match {
    type = "google_dataplex_asset"
  }

  as = concept.dataplex-asset
}

rule "dataplex-data-asset" {
  match {
    type = "google_dataplex_data_asset"
  }

  as = concept.dataplex-asset
}
