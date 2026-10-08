rule "cloudwatch-event-bus" {
  match {
    type = "aws_cloudwatch_event_bus"
  }

  as = concept.event-bus

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "cloudwatch-event-rule" {
  match {
    type = "aws_cloudwatch_event_rule"
  }

  as = concept.event-component

  contribution {
    to  = concept.event-bus
    via = source.event_bus_name

    on_null  = "absent"
    on_empty = "absent"
    match {
      by       = target.name
      strategy = "exact"
    }
  }
}

rule "cloudwatch-event-target" {
  match {
    type = "aws_cloudwatch_event_target"
  }

  as = concept.event-component
}
