rule "globalaccelerator-accelerator" {
  match {
    type = "aws_globalaccelerator_accelerator"
  }

  as = concept.global-accelerator

  identity {
    attributes = ["arn"]
    scope      = "global"
  }

  endpoint {
    attributes = ["arn", "id"]
  }
}

rule "globalaccelerator-listener" {
  match {
    type = "aws_globalaccelerator_listener"
  }

  as = concept.global-accelerator-component

  contribution {
    to       = concept.global-accelerator
    via      = source.accelerator_arn
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.arn
      strategy = "exact"
    }
  }
}

rule "globalaccelerator-endpoint-group" {
  match {
    type = "aws_globalaccelerator_endpoint_group"
  }

  as = concept.global-accelerator-component
}

rule "globalaccelerator-custom-routing-accelerator" {
  match {
    type = "aws_globalaccelerator_custom_routing_accelerator"
  }

  as = concept.global-accelerator

  identity {
    attributes = ["arn"]
    scope      = "global"
  }

  endpoint {
    attributes = ["arn", "id"]
  }
}

rule "globalaccelerator-custom-routing-listener" {
  match {
    type = "aws_globalaccelerator_custom_routing_listener"
  }

  as = concept.global-accelerator-component

  contribution {
    to       = concept.global-accelerator
    via      = source.accelerator_arn
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.arn
      strategy = "exact"
    }
  }
}

rule "globalaccelerator-custom-routing-endpoint-group" {
  match {
    type = "aws_globalaccelerator_custom_routing_endpoint_group"
  }

  as = concept.global-accelerator-component
}
