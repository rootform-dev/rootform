# Maintained directly from pinned provider evidence.
concept "stream-analytics-job" {
  description = "An Azure Stream Analytics streaming query job."
}

rule "stream-analytics-cluster" {
  match {
    type = "azurerm_stream_analytics_cluster"
  }

  as = concept.analytics-cluster

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

rule "stream-analytics-job" {
  match {
    type = "azurerm_stream_analytics_job"
  }

  as = concept.stream-analytics-job

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
