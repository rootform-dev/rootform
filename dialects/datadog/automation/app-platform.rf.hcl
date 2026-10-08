concept "application-datastore" {
  description = "A Datadog-managed datastore used by App Builder and Workflow Automation."
}

concept "automation-application" {
  description = "An application assembled and published with Datadog App Builder."
}

rule "app-builder-app" {
  match {
    type = "datadog_app_builder_app"
  }

  as = concept.automation-application
}

rule "app-builder-app-lookup" {
  match {
    kind = "data"
    type = "datadog_app_builder_app"
  }

  as = concept.automation-application
}

rule "datastore" {
  match {
    type = "datadog_datastore"
  }

  as = concept.application-datastore

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "datastore-item" {
  match {
    type = "datadog_datastore_item"
  }

  as = concept.service-integration-configuration

  contribution {
    to       = concept.application-datastore
    via      = source.datastore_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "datastore-item-lookup" {
  match {
    kind = "data"
    type = "datadog_datastore_item"
  }

  as = concept.service-integration-configuration

  contribution {
    to       = concept.application-datastore
    via      = source.datastore_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "datastore-lookup" {
  match {
    kind = "data"
    type = "datadog_datastore"
  }

  as = concept.application-datastore

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
