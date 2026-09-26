# Maintained directly from pinned provider evidence.
concept "health-data-service" {
  description = "A FHIR, DICOM, or MedTech service in Azure Health Data Services."
}

concept "health-data-workspace" {
  description = "An Azure Health Data Services workspace owning healthcare data services."
}

rule "health-data-dicom-service" {
  match {
    type = "azurerm_healthcare_dicom_service"
  }

  as = concept.health-data-service
}

rule "health-data-fhir-service" {
  match {
    type = "azurerm_healthcare_fhir_service"
  }

  as = concept.health-data-service

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

rule "health-data-medtech-service" {
  match {
    type = "azurerm_healthcare_medtech_service"
  }

  as = concept.health-data-service
}

rule "health-data-services-workspace" {
  match {
    type = "azurerm_healthcare_workspace"
  }

  as = concept.health-data-workspace

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

rule "healthcare-service" {
  match {
    type = "azurerm_healthcare_service"
  }

  as = concept.health-data-service

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
