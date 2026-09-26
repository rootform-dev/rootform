rule "emr-instance-fleet" {
  match {
    type = "aws_emr_instance_fleet"
  }

  as = concept.emr-cluster-component

  contribution {
    to       = concept.emr-cluster
    via      = source.cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "emr-instance-group" {
  match {
    type = "aws_emr_instance_group"
  }

  as = concept.emr-cluster-component

  contribution {
    to       = concept.emr-cluster
    via      = source.cluster_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
