# Reproducible Rootform Playground source. This is an architecture example, not a deployment recipe.
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
  }
}

provider "google" {
  region = "europe-west1"
}

variable "org_id" {
  description = "Numeric ID of the Google Cloud organization that owns the projects."
  type        = string
}

variable "billing_account" {
  description = "Billing account attached to the projects."
  type        = string
}

variable "ingest_hmac_key" {
  description = "HMAC key used by ingest-api to sign accepted events."
  type        = string
  sensitive   = true
}

variable "warehouse_db_password" {
  description = "Password of the warehouse application user on Cloud SQL."
  type        = string
  sensitive   = true
}

variable "legacy_warehouse_credentials" {
  description = "Credentials of the legacy on-premises warehouse synchronised by the nightly job."
  type        = string
  sensitive   = true
}

locals {
  region = "europe-west1"
  labels = {
    environment = "production"
    system      = "data-platform"
    owner       = "data-platform-engineering"
    cost_center = "cc-5120"
  }
}

# Ownership: a Shared VPC host project owns network infrastructure; a service project owns workloads and data services.

resource "google_project" "network" {
  name            = "plt-shared-net"
  project_id      = "plt-shared-net-4a7c"
  org_id          = var.org_id
  billing_account = var.billing_account
  labels          = local.labels
  deletion_policy = "PREVENT"
}

resource "google_project" "data" {
  name            = "plt-data-prod"
  project_id      = "plt-data-prod-4a7c"
  org_id          = var.org_id
  billing_account = var.billing_account
  labels          = local.labels
  deletion_policy = "PREVENT"
}

# Network: one VPC with the GKE subnet, the connector subnet, Cloud NAT, and private services access.

resource "google_compute_network" "shared" {
  name                    = "vpc-data-shared"
  project                 = google_project.network.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "gke" {
  name                     = "snet-gke"
  project                  = google_project.network.project_id
  region                   = local.region
  network                  = google_compute_network.shared.id
  ip_cidr_range            = "10.60.0.0/20"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.61.0.0/16"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.62.0.0/20"
  }

  log_config {
    aggregation_interval = "INTERVAL_5_MIN"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "data" {
  name                     = "snet-data"
  project                  = google_project.network.project_id
  region                   = local.region
  network                  = google_compute_network.shared.id
  ip_cidr_range            = "10.60.20.0/24"
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "serverless" {
  name          = "snet-serverless"
  project       = google_project.network.project_id
  region        = local.region
  network       = google_compute_network.shared.id
  ip_cidr_range = "10.60.16.0/28"
}

resource "google_compute_router" "shared" {
  name    = "cr-data-shared"
  project = google_project.network.project_id
  region  = local.region
  network = google_compute_network.shared.id
}

resource "google_compute_router_nat" "shared" {
  name                               = "nat-data-shared"
  project                            = google_project.network.project_id
  region                             = local.region
  router                             = google_compute_router.shared.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  enable_dynamic_port_allocation     = true

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_firewall" "allow_internal" {
  name      = "fw-data-shared-allow-internal"
  project   = google_project.network.project_id
  network   = google_compute_network.shared.id
  direction = "INGRESS"
  priority  = 1000

  source_ranges = ["10.60.0.0/16", "10.61.0.0/16", "10.62.0.0/20"]

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }
}

resource "google_compute_firewall" "allow_health_checks" {
  name      = "fw-data-shared-allow-health-checks"
  project   = google_project.network.project_id
  network   = google_compute_network.shared.id
  direction = "INGRESS"
  priority  = 900

  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["gke-node"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080", "9090"]
  }
}

resource "google_compute_global_address" "private_services" {
  name          = "psa-data-shared"
  project       = google_project.network.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.shared.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.shared.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

resource "google_vpc_access_connector" "data" {
  name          = "vac-data-prod"
  project       = google_project.data.project_id
  region        = local.region
  machine_type  = "e2-micro"
  min_instances = 2
  max_instances = 6

  subnet {
    name       = google_compute_subnetwork.serverless.name
    project_id = google_project.network.project_id
  }
}

# Identity: one service account per workload, bound to project roles.

resource "google_service_account" "gke_nodes" {
  account_id   = "sa-gke-nodes"
  project      = google_project.data.project_id
  display_name = "GKE node pool identity"
}

resource "google_service_account" "ingest_api" {
  account_id   = "sa-ingest-api"
  project      = google_project.data.project_id
  display_name = "ingest-api runtime identity"
}

resource "google_service_account" "enrichment" {
  account_id   = "sa-enrichment"
  project      = google_project.data.project_id
  display_name = "enrichment runtime identity"
}

resource "google_service_account" "warehouse_loader" {
  account_id   = "sa-warehouse-loader"
  project      = google_project.data.project_id
  display_name = "warehouse-loader runtime identity"
}

resource "google_service_account" "streaming" {
  account_id   = "sa-streaming"
  project      = google_project.data.project_id
  display_name = "Streaming consumers identity"
}

resource "google_service_account" "pubsub_push" {
  account_id   = "sa-pubsub-push"
  project      = google_project.data.project_id
  display_name = "Pub/Sub push delivery identity"
}

resource "google_project_iam_member" "gke_nodes_log_writer" {
  project = google_project.data.project_id
  role    = "roles/logging.logWriter"
  member  = google_service_account.gke_nodes.member
}

resource "google_project_iam_member" "gke_nodes_metric_writer" {
  project = google_project.data.project_id
  role    = "roles/monitoring.metricWriter"
  member  = google_service_account.gke_nodes.member
}

resource "google_project_iam_member" "ingest_api_publisher" {
  project = google_project.data.project_id
  role    = "roles/pubsub.publisher"
  member  = google_service_account.ingest_api.member
}

resource "google_project_iam_member" "enrichment_publisher" {
  project = google_project.data.project_id
  role    = "roles/pubsub.publisher"
  member  = google_service_account.enrichment.member
}

resource "google_project_iam_member" "warehouse_loader_sql_client" {
  project = google_project.data.project_id
  role    = "roles/cloudsql.client"
  member  = google_service_account.warehouse_loader.member
}

resource "google_project_iam_member" "streaming_subscriber" {
  project = google_project.data.project_id
  role    = "roles/pubsub.subscriber"
  member  = google_service_account.streaming.member
}

resource "google_project_iam_member" "pubsub_push_invoker" {
  project = google_project.data.project_id
  role    = "roles/run.invoker"
  member  = google_service_account.pubsub_push.member
}

# Secrets: runtime credentials live in Secret Manager and reach workloads by reference.

resource "google_secret_manager_secret" "ingest_hmac" {
  secret_id = "ingest-hmac-key"
  project   = google_project.data.project_id
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "ingest_hmac" {
  secret      = google_secret_manager_secret.ingest_hmac.id
  secret_data = var.ingest_hmac_key
}

resource "google_secret_manager_secret" "warehouse_db_password" {
  secret_id = "warehouse-db-password"
  project   = google_project.data.project_id
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "warehouse_db_password" {
  secret      = google_secret_manager_secret.warehouse_db_password.id
  secret_data = var.warehouse_db_password
}

resource "google_secret_manager_secret" "legacy_warehouse" {
  secret_id = "legacy-warehouse-credentials"
  project   = google_project.data.project_id
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "legacy_warehouse" {
  secret      = google_secret_manager_secret.legacy_warehouse.id
  secret_data = var.legacy_warehouse_credentials
}

# Data: Cloud SQL and Memorystore reach the VPC through private services access.

resource "google_sql_database_instance" "data" {
  name                = "sql-data-prod"
  project             = google_project.data.project_id
  region              = local.region
  database_version    = "POSTGRES_16"
  deletion_protection = true

  settings {
    tier              = "db-custom-4-16384"
    edition           = "ENTERPRISE"
    availability_type = "REGIONAL"
    disk_type         = "PD_SSD"
    disk_size         = 200
    disk_autoresize   = true
    user_labels       = local.labels

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.shared.id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"

      backup_retention_settings {
        retained_backups = 14
      }
    }

    insights_config {
      query_insights_enabled = true
    }

    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }
  }

  depends_on = [google_service_networking_connection.private_services]
}

resource "google_redis_instance" "data" {
  name                    = "redis-data-prod"
  project                 = google_project.data.project_id
  region                  = local.region
  tier                    = "STANDARD_HA"
  memory_size_gb          = 5
  redis_version           = "REDIS_7_0"
  authorized_network      = google_compute_network.shared.id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  auth_enabled            = true
  labels                  = local.labels

  depends_on = [google_service_networking_connection.private_services]
}

# Messaging: raw events are enriched, loaded and streamed through push subscriptions; the sessions consumer pulls, and undeliverable messages go to a dead-letter topic.

resource "google_pubsub_topic" "events_raw" {
  name                       = "events-raw"
  project                    = google_project.data.project_id
  message_retention_duration = "604800s"
  labels                     = local.labels
}

resource "google_pubsub_topic" "events_enriched" {
  name                       = "events-enriched"
  project                    = google_project.data.project_id
  message_retention_duration = "604800s"
  labels                     = local.labels
}

resource "google_pubsub_topic" "events_dlq" {
  name                       = "events-dlq"
  project                    = google_project.data.project_id
  message_retention_duration = "2592000s"
  labels                     = local.labels
}

resource "google_pubsub_subscription" "events_raw_enrichment" {
  name                 = "events-raw-enrichment"
  project              = google_project.data.project_id
  topic                = google_pubsub_topic.events_raw.id
  ack_deadline_seconds = 60
  labels               = local.labels

  push_config {
    push_endpoint = google_cloud_run_v2_service.enrichment.uri

    oidc_token {
      service_account_email = google_service_account.pubsub_push.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "events_enriched_warehouse" {
  name                 = "events-enriched-warehouse"
  project              = google_project.data.project_id
  topic                = google_pubsub_topic.events_enriched.id
  ack_deadline_seconds = 120
  labels               = local.labels

  push_config {
    push_endpoint = google_cloud_run_v2_service.warehouse_loader.uri

    oidc_token {
      service_account_email = google_service_account.pubsub_push.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "events_raw_stream_consumer" {
  name                       = "events-raw-stream-consumer"
  project                    = google_project.data.project_id
  topic                      = google_pubsub_topic.events_raw.id
  ack_deadline_seconds       = 30
  message_retention_duration = "86400s"
  labels                     = local.labels

  push_config {
    push_endpoint = google_cloud_run_v2_service.stream_consumer.uri

    oidc_token {
      service_account_email = google_service_account.pubsub_push.email
    }
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "events_enriched_sessions" {
  name                       = "events-enriched-sessions"
  project                    = google_project.data.project_id
  topic                      = google_pubsub_topic.events_enriched.id
  ack_deadline_seconds       = 30
  message_retention_duration = "86400s"
  labels                     = local.labels

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "events_dlq_inspector" {
  name                       = "events-dlq-inspector"
  project                    = google_project.data.project_id
  topic                      = google_pubsub_topic.events_dlq.id
  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"
  labels                     = local.labels

  expiration_policy {
    ttl = ""
  }
}

# Dead-lettering: the Pub/Sub service agent forwards undeliverable messages to the dead-letter topic.

resource "google_project_iam_member" "pubsub_agent_publisher" {
  project = google_project.data.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${google_project.data.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "pubsub_agent_subscriber" {
  project = google_project.data.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:service-${google_project.data.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Serverless: Cloud Run services run as their own identity and reach the VPC through the connector.

resource "google_cloud_run_v2_service" "ingest_api" {
  name                = "ingest-api"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.ingest_api.email

    scaling {
      min_instance_count = 2
      max_instance_count = 40
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/ingest-api:2026.09.1"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "EVENTS_RAW_TOPIC"
        value = google_pubsub_topic.events_raw.id
      }

      env {
        name = "INGEST_HMAC_KEY"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.ingest_hmac.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "enrichment" {
  name                = "enrichment"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.enrichment.email

    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/enrichment:2026.09.1"

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      env {
        name  = "EVENTS_ENRICHED_TOPIC"
        value = google_pubsub_topic.events_enriched.id
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.data.host
      }
    }
  }
}

resource "google_cloud_run_v2_service" "warehouse_loader" {
  name                = "warehouse-loader"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.warehouse_loader.email

    scaling {
      min_instance_count = 1
      max_instance_count = 10
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/warehouse-loader:2026.09.1"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "CLOUD_SQL_CONNECTION_NAME"
        value = google_sql_database_instance.data.connection_name
      }

      env {
        name = "WAREHOUSE_DB_PASSWORD"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.warehouse_db_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service" "stream_consumer" {
  name                = "stream-consumer"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.streaming.email

    scaling {
      min_instance_count = 2
      max_instance_count = 60
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/stream-consumer:2026.10.0"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.data.host
      }
    }
  }
}

resource "google_cloud_run_v2_job" "legacy_warehouse_sync" {
  name                = "legacy-warehouse-sync"
  project             = google_project.data.project_id
  location            = local.region
  deletion_protection = false
  labels              = local.labels

  template {
    task_count = 1

    template {
      service_account = google_service_account.warehouse_loader.email
      max_retries     = 1
      timeout         = "3600s"

      vpc_access {
        connector = google_vpc_access_connector.data.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/legacy-warehouse-sync:2026.08.3"

        env {
          name  = "CLOUD_SQL_CONNECTION_NAME"
          value = google_sql_database_instance.data.connection_name
        }

        env {
          name = "LEGACY_WAREHOUSE_CREDENTIALS"

          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.legacy_warehouse.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

# Observability: a custom service with an availability objective, and an alert on subscription backlog age.

resource "google_monitoring_service" "ingest_api" {
  service_id   = "ingest-api"
  project      = google_project.data.project_id
  display_name = "ingest-api"

  basic_service {
    service_type = "CLOUD_RUN"

    service_labels = {
      service_name = google_cloud_run_v2_service.ingest_api.name
      location     = local.region
    }
  }
}

resource "google_monitoring_slo" "ingest_api_availability" {
  service             = google_monitoring_service.ingest_api.service_id
  project             = google_project.data.project_id
  slo_id              = "ingest-api-availability"
  display_name        = "ingest-api 99.9% availability over 28 days"
  goal                = 0.999
  rolling_period_days = 28

  basic_sli {
    availability {
      enabled = true
    }
  }
}

resource "google_monitoring_alert_policy" "subscription_backlog" {
  display_name = "Pub/Sub backlog older than 10 minutes"
  project      = google_project.data.project_id
  combiner     = "OR"
  user_labels  = local.labels

  conditions {
    display_name = "oldest unacked message age"

    condition_threshold {
      filter          = "resource.type = \"pubsub_subscription\" AND metric.type = \"pubsub.googleapis.com/subscription/oldest_unacked_message_age\""
      comparison      = "COMPARISON_GT"
      threshold_value = 600
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }
    }
  }
}

# Compute: one private GKE cluster with a workloads node pool. Workloads reach it through the teams' GitOps pipeline, outside this configuration.

resource "google_container_cluster" "data" {
  name                     = "gke-data-prod"
  project                  = google_project.data.project_id
  location                 = local.region
  network                  = google_compute_network.shared.id
  subnetwork               = google_compute_subnetwork.gke.id
  networking_mode          = "VPC_NATIVE"
  datapath_provider        = "ADVANCED_DATAPATH"
  remove_default_node_pool = true
  initial_node_count       = 1
  deletion_protection      = true
  resource_labels          = local.labels

  ip_allocation_policy {
    cluster_secondary_range_name  = google_compute_subnetwork.gke.secondary_ip_range[0].range_name
    services_secondary_range_name = google_compute_subnetwork.gke.secondary_ip_range[1].range_name
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "10.60.0.0/16"
      display_name = "vpc-data-shared"
    }
  }

  release_channel {
    channel = "REGULAR"
  }

  workload_identity_config {
    workload_pool = "${google_project.data.project_id}.svc.id.goog"
  }

  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]

    managed_prometheus {
      enabled = true
    }
  }

  addons_config {
    http_load_balancing {
      disabled = false
    }

    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }
}

resource "google_container_node_pool" "workloads" {
  name     = "np-workloads"
  project  = google_project.data.project_id
  location = local.region
  cluster  = google_container_cluster.data.id

  autoscaling {
    min_node_count = 1
    max_node_count = 6
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type    = "n2-standard-4"
    disk_type       = "pd-balanced"
    disk_size_gb    = 100
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
    labels          = local.labels
    tags            = ["gke-node"]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}
