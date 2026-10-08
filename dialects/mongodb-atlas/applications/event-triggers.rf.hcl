concept "event-trigger" {
  description = "A MongoDB Atlas App Services trigger responding to a database, schedule, or authentication event."
}

rule "event-trigger" {
  match {
    type = "mongodbatlas_event_trigger"
  }

  as = concept.event-trigger

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
