concept "search-deployment" {
  description = "A dedicated MongoDB Search deployment providing isolated search compute for an Atlas database deployment."
}

concept "search-configuration" {
  description = "A search, vector-search, or AI model configuration supporting Atlas."
}

rule "search-deployment" {
  match {
    type = "mongodbatlas_search_deployment"
  }

  as = concept.search-deployment

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

  relation "serves" {
    to       = rf.concept.managed-database
    via      = source.cluster_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "search-index" {
  match {
    type = "mongodbatlas_search_index"
  }

  as = concept.search-configuration

  contribution {
    to       = rf.concept.managed-database
    via      = source.cluster_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }

    # Shared managed-database instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "ai-model-rate-limit" {
  match {
    type = "mongodbatlas_ai_model_rate_limit"
  }

  as = concept.search-configuration

  contribution {
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
