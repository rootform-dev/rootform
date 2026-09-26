rule "lb" {
  match {
    type = "aws_lb"
  }

  as = concept.load-balancer

  identity {
    attributes = ["arn"]
    scope      = "global"
  }

  endpoint {
    attributes = ["arn", "id"]
  }
}

rule "lb-listener" {
  match {
    type = "aws_lb_listener"
  }

  as = concept.load-balancer-component

  contribution {
    to       = concept.load-balancer
    via      = source.load_balancer_arn
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.arn
      strategy = "exact"
    }
  }
}

rule "lb-target-group" {
  match {
    type = "aws_lb_target_group"
  }

  as = concept.load-balancer-component
}

rule "alb-target-group" {
  match {
    type = "aws_alb_target_group"
  }

  as = concept.load-balancer-component
}
