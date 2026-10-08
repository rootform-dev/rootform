terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "= 8.0.0"
    }
  }
}

resource "google_dialogflow_cx_agent" "support" {
  location              = "westeurope"
  default_language_code = "fx-support-default-language-code"
  display_name          = "fx-support-display-name"
  time_zone             = "fx-support-time-zone"

}
resource "google_apigee_instance" "runtime" {
  location = "westeurope"
  name     = "fx-runtime-name"
  org_id   = "fx-runtime-org-id"
}
resource "google_workflows_workflow" "orchestration" {
  source_contents = "fx-orchestration-source-contents"
}
resource "google_vmwareengine_private_cloud" "private_cloud" {
  management_cluster {
    cluster_id = "fx-private-cloud-cluster-id"
  }
  network_config {
    management_cidr = "10.0.0.0/24"
  }
  name     = "fx-private-cloud-name"
  location = "westeurope"
}
resource "google_database_migration_service_migration_job" "migration" {
  type             = "ONE_TIME"
  destination      = "fx-migration-destination"
  migration_job_id = "fx-migration-migration-job-id"
  source           = "fx-migration-source"
}
resource "google_compute_disk" "data" {
  name = "fx-data-name"
}
resource "google_redis_instance" "cache" {
  name           = "fx-cache-name"
  memory_size_gb = 1
}
resource "google_backup_dr_backup_vault" "recovery" {
  backup_minimum_enforced_retention_duration = "fx-recovery-backup-minimum-enforced-retention-du"
  backup_vault_id                            = "fx-recovery-backup-vault-id"
  location                                   = "westeurope"
}
resource "google_logging_project_sink" "audit" {
  name        = "fx-audit-name"
  destination = "fx-audit-destination"
}
resource "google_compute_firewall" "ingress" {
  allow {
    protocol = "tcp"
  }
  network       = "fx-ingress-network"
  name          = "fx-ingress-name"
  source_ranges = ["10.0.0.0/8"]
}
resource "google_cloudbuild_worker_pool" "build" {
  location = "westeurope"
  name     = "fx-build-name"
}
resource "google_healthcare_dataset" "clinical" {
  name     = "fx-clinical-name"
  location = "westeurope"
}
resource "google_filestore_instance" "shared" {
  file_shares {
    name        = "fx-shared-name"
    capacity_gb = 1
  }
  networks {
    network = "fx-shared-network"
    modes   = ["ADDRESS_MODE_UNSPECIFIED"]
  }
  tier = "fx-shared-tier"
  name = "fx-shared-name"
}
resource "google_network_connectivity_hub" "hub" {
}
resource "google_vertex_ai_endpoint" "inference" {
  name         = "fx-inference-name"
  location     = "westeurope"
  display_name = "fx-inference-display-name"
}
resource "google_spanner_instance" "database" {
  autoscaling_config {
  }
  display_name = "fx-database-display-name"
  config       = "fx-database-config"
}
resource "google_ces_app" "customer_experience" {
  location     = "westeurope"
  app_id       = "fx-customer-experience-app-id"
  display_name = "fx-customer-experience-display-name"
}
resource "google_ces_agent" "support_agent" {
  location     = "westeurope"
  app          = "fx-support-agent-app"
  display_name = "fx-support-agent-display-name"
}
resource "google_agent_registry_service" "agent_catalog" {
  agent_spec {
    type = "NO_SPEC"
  }
  service_id = "fx-agent-catalog-service-id"
  location   = "westeurope"
}
resource "google_colab_runtime" "notebook" {
  display_name = "fx-notebook-display-name"
  runtime_user = "fx-notebook-runtime-user"
  location     = "westeurope"
}
resource "google_network_services_agent_gateway" "agents" {
  google_managed {
    governed_access_path = "AGENT_TO_ANYWHERE"
  }
  location = "westeurope"
  name     = "fx-agents-name"
}
resource "google_network_services_multicast_domain" "streaming" {
  connection_config {
    connection_type = "fx-streaming-connection-type"
  }
  admin_network       = "fx-streaming-admin-network"
  location            = "westeurope"
  multicast_domain_id = "fx-streaming-multicast-domain-id"
}
resource "google_network_services_multicast_domain_group" "streaming_ha" {
  location                  = "westeurope"
  multicast_domain_group_id = "fx-streaming-ha-multicast-domain-group-id"
}
resource "google_gke_backup_restore_plan" "cluster_recovery" {
  restore_config {
    all_namespaces = false
  }
  name        = "fx-cluster-recovery-name"
  backup_plan = "fx-cluster-recovery-backup-plan"
  cluster     = "fx-cluster-recovery-cluster"
  location    = "westeurope"
}
resource "google_data_loss_prevention_discovery_config" "sensitive_data" {
  location = "westeurope"
  parent   = "fx-sensitive-data-parent"
}
resource "google_model_armor_template" "ai_guardrail" {
  filter_config {
  }
  template_id = "fx-ai-guardrail-template-id"
  location    = "westeurope"
}
resource "google_cloud_security_compliance_framework" "compliance" {
  location     = "westeurope"
  framework_id = "fx-compliance-framework-id"
}
resource "google_migration_center_source" "discovery" {
  source_id = "fx-discovery-source-id"
  location  = "westeurope"
}
resource "google_os_config_patch_deployment" "patching" {
  one_time_schedule {
    execute_time = "fx-patching-execute-time"
  }
  instance_filter {
    all = false
  }
  patch_deployment_id = "fx-patching-patch-deployment-id"
}
resource "google_privileged_access_manager_entitlement" "elevated_access" {
  eligible_users {
    principals = ["fx-elevated-access-principals"]
  }
  privileged_access {
    gcp_iam_access {
      role_bindings {
        role = "fx-elevated-access-role"
      }
      resource_type = "fx-elevated-access-resource-type"
      resource      = "fx-elevated-access-resource"
    }
  }
  requester_justification_config {
  }
  max_request_duration = "fx-elevated-access-max-request-duration"
  entitlement_id       = "fx-elevated-access-entitlement-id"
  parent               = "fx-elevated-access-parent"
  location             = "westeurope"
}
resource "google_security_scanner_scan_config" "web_scan" {
  display_name  = "fx-web-scan-display-name"
  starting_urls = ["fx-web-scan-starting-urls"]
  provider      = google-beta
}
