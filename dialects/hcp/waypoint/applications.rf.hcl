concept "waypoint-add-on" {
  description = "Supporting infrastructure installed for an HCP Waypoint application."
}

concept "waypoint-add-on-definition" {
  description = "A reusable HCP Waypoint definition for application supporting infrastructure."
}

concept "waypoint-agent-group" {
  description = "A group of agents executing HCP Waypoint actions."
}

concept "waypoint-application" {
  description = "An application instantiated and managed through HCP Waypoint."
}

concept "waypoint-configuration" {
  description = "An action or HCP Terraform connection supporting HCP Waypoint."
}

concept "waypoint-template" {
  description = "A reusable HCP Waypoint golden pattern for application infrastructure."
}

rule "waypoint-action" {
  match {
    type = "hcp_waypoint_action"
  }

  as = concept.waypoint-configuration
}

rule "waypoint-action-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_action"
  }

  as = concept.waypoint-configuration
}

rule "waypoint-add-on" {
  match {
    type = "hcp_waypoint_add_on"
  }

  as = concept.waypoint-add-on

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "extends-application" {
    to       = concept.waypoint-application
    via      = source.application_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "instantiates-definition" {
    to       = concept.waypoint-add-on-definition
    via      = source.definition_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "waypoint-add-on-definition" {
  match {
    type = "hcp_waypoint_add_on_definition"
  }

  as = concept.waypoint-add-on-definition

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-add-on-definition-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_add_on_definition"
  }

  as = concept.waypoint-add-on-definition

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-add-on-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_add_on"
  }

  as = concept.waypoint-add-on

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "extends-application" {
    to       = concept.waypoint-application
    via      = source.application_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }

  relation "instantiates-definition" {
    to       = concept.waypoint-add-on-definition
    via      = source.definition_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "waypoint-agent-group" {
  match {
    type = "hcp_waypoint_agent_group"
  }

  as = concept.waypoint-agent-group

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-agent-group-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_agent_group"
  }

  as = concept.waypoint-agent-group

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-application" {
  match {
    type = "hcp_waypoint_application"
  }

  as = concept.waypoint-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-template" {
    to       = concept.waypoint-template
    via      = source.template_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "waypoint-application-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_application"
  }

  as = concept.waypoint-application

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }

  relation "uses-template" {
    to       = concept.waypoint-template
    via      = source.template_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}

rule "waypoint-template" {
  match {
    type = "hcp_waypoint_template"
  }

  as = concept.waypoint-template

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-template-lookup" {
  match {
    kind = "data"
    type = "hcp_waypoint_template"
  }

  as = concept.waypoint-template

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }

  context {
    as       = context.ownership
    to       = concept.project
    via      = source.project_id
    on_null  = "indeterminate"
    on_empty = "indeterminate"

    match {
      by       = target.resource_id
      strategy = "exact"
    }

    # Shared project instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "waypoint-tfc-config" {
  match {
    type = "hcp_waypoint_tfc_config"
  }

  as = concept.waypoint-configuration
}
