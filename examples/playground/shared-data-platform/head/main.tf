# Reproducible Rootform Playground source. This is an architecture example, not a deployment recipe.
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 8.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "= 2.38.0"
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

# Network: one VPC with the GKE subnet, the connector and egress subnets, Cloud NAT, and private services access.

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

resource "google_compute_subnetwork" "serverless_apps" {
  name          = "snet-serverless-apps"
  project       = google_project.network.project_id
  region        = local.region
  network       = google_compute_network.shared.id
  ip_cidr_range = "10.60.32.0/28"
}

resource "google_compute_subnetwork" "run_egress" {
  name                     = "snet-run-egress"
  project                  = google_project.network.project_id
  region                   = local.region
  network                  = google_compute_network.shared.id
  ip_cidr_range            = "10.60.48.0/24"
  private_ip_google_access = true
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
    name       = google_compute_subnetwork.serverless_apps.name
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

# Messaging: every consumer is a push subscription to Cloud Run with a dead-letter topic; only replay pulls.

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
    push_endpoint = google_cloud_run_v2_service.enrichment_streaming.uri

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

resource "google_pubsub_subscription" "events_raw_stream_processor" {
  name                 = "events-raw-stream-processor"
  project              = google_project.data.project_id
  topic                = google_pubsub_topic.events_raw.id
  ack_deadline_seconds = 30
  labels               = local.labels

  push_config {
    push_endpoint = google_cloud_run_v2_service.stream_processor.uri

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

resource "google_pubsub_subscription" "events_enriched_session_windower" {
  name                 = "events-enriched-session-windower"
  project              = google_project.data.project_id
  topic                = google_pubsub_topic.events_enriched.id
  ack_deadline_seconds = 60
  labels               = local.labels

  push_config {
    push_endpoint = google_cloud_run_v2_service.session_windower.uri

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

resource "google_pubsub_subscription" "events_raw_replay" {
  name                       = "events-raw-replay"
  project                    = google_project.data.project_id
  topic                      = google_pubsub_topic.events_raw.id
  ack_deadline_seconds       = 120
  message_retention_duration = "604800s"
  retain_acked_messages      = true
  labels                     = local.labels

  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "events_dlq_inspector" {
  name                 = "events-dlq-inspector"
  project              = google_project.data.project_id
  topic                = google_pubsub_topic.events_dlq.id
  ack_deadline_seconds = 600
  labels               = local.labels

  expiration_policy {
    ttl = ""
  }
}

# Serverless: Cloud Run services run as their own identity; the loader uses Direct VPC egress, the others the connector.

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

resource "google_cloud_run_v2_service" "enrichment_streaming" {
  name                = "enrichment-streaming"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.enrichment.email

    scaling {
      min_instance_count = 1
      max_instance_count = 40
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/enrichment:2026.10.0"

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
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

resource "google_cloud_run_v2_service" "stream_processor" {
  name                = "stream-processor"
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
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/stream-processor:2026.10.0"

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

resource "google_cloud_run_v2_service" "session_windower" {
  name                = "session-windower"
  project             = google_project.data.project_id
  location            = local.region
  ingress             = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  deletion_protection = true
  labels              = local.labels

  template {
    service_account = google_service_account.streaming.email

    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }

    vpc_access {
      connector = google_vpc_access_connector.data.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/session-windower:2026.10.0"

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
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
      egress = "PRIVATE_RANGES_ONLY"

      network_interfaces {
        network    = google_compute_network.shared.id
        subnetwork = google_compute_subnetwork.run_egress.id
      }
    }

    containers {
      image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/warehouse-loader:2026.10.0"

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

# Compute: one private GKE cluster with a workloads node pool.

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

# Kubernetes: the provider talks to the cluster endpoint, so every namespace and workload runs there.

provider "kubernetes" {
  host                   = "https://${google_container_cluster.data.endpoint}"
  cluster_ca_certificate = base64decode(google_container_cluster.data.master_auth[0].cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "gke-gcloud-auth-plugin"
  }
}
resource "kubernetes_namespace_v1" "batch" {
  metadata {
    name = "batch"

    labels = {
      "app.kubernetes.io/part-of"          = "data-platform"
      "plt.example/team"                   = "batch-processing"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "analytics" {
  metadata {
    name = "analytics"

    labels = {
      "app.kubernetes.io/part-of"          = "data-platform"
      "plt.example/team"                   = "analytics"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "streaming" {
  metadata {
    name = "streaming"

    labels = {
      "app.kubernetes.io/part-of"          = "data-platform"
      "plt.example/team"                   = "streaming"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

resource "kubernetes_namespace_v1" "observability" {
  metadata {
    name = "observability"

    labels = {
      "app.kubernetes.io/part-of"          = "data-platform"
      "plt.example/team"                   = "platform-sre"
      "pod-security.kubernetes.io/enforce" = "restricted"
    }
  }
}

# Service accounts: streaming consumers and the feature builder map to Google identities through Workload Identity.

resource "kubernetes_service_account_v1" "feature_builder" {
  metadata {
    name      = "feature-builder"
    namespace = kubernetes_namespace_v1.batch.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "feature_store" {
  metadata {
    name      = "feature-store"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "analytics_api" {
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "replay_worker" {
  metadata {
    name      = "replay-worker"
    namespace = kubernetes_namespace_v1.streaming.metadata[0].name

    annotations = {
      "iam.gke.io/gcp-service-account" = google_service_account.streaming.email
    }
  }
}

resource "kubernetes_service_account_v1" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }
}

resource "kubernetes_service_account_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }
}

# Workloads.

resource "kubernetes_deployment_v1" "feature_builder" {
  metadata {
    name      = "feature-builder"
    namespace = kubernetes_namespace_v1.batch.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "feature-builder"
      "app.kubernetes.io/component" = "batch"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "feature-builder"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "feature-builder"
          "app.kubernetes.io/component" = "batch"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.feature_builder.metadata[0].name

        container {
          name  = "feature-builder"
          image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/feature-builder:2026.09.1"

          env {
            name  = "REDIS_HOST"
            value = google_redis_instance.data.host
          }

          env {
            name  = "FEATURE_STORE_HOST"
            value = "feature-store.analytics.svc.cluster.local"
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "1Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "analytics_api" {
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "analytics-api"
      "app.kubernetes.io/component" = "api"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "analytics-api"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "analytics-api"
          "app.kubernetes.io/component" = "api"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.analytics_api.metadata[0].name

        container {
          name  = "analytics-api"
          image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/analytics-api:2026.09.1"

          port {
            name           = "http"
            container_port = 8080
          }

          env {
            name  = "CLOUD_SQL_CONNECTION_NAME"
            value = google_sql_database_instance.data.connection_name
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "replay_worker" {
  metadata {
    name      = "replay-worker"
    namespace = kubernetes_namespace_v1.streaming.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "replay-worker"
      "app.kubernetes.io/component" = "replay"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "replay-worker"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "replay-worker"
          "app.kubernetes.io/component" = "replay"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.replay_worker.metadata[0].name

        container {
          name  = "replay-worker"
          image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/replay-worker:2026.10.0"

          env {
            name  = "PUBSUB_SUBSCRIPTION"
            value = google_pubsub_subscription.events_raw_replay.name
          }

          env {
            name  = "EVENTS_RAW_TOPIC"
            value = google_pubsub_topic.events_raw.id
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_stateful_set_v1" "feature_store" {
  metadata {
    name      = "feature-store"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "feature-store"
      "app.kubernetes.io/component" = "store"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    service_name = "feature-store"
    replicas     = 3

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "feature-store"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "feature-store"
          "app.kubernetes.io/component" = "store"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.feature_store.metadata[0].name

        container {
          name  = "feast"
          image = "europe-west1-docker.pkg.dev/plt-data-prod-4a7c/data-platform/feature-store:2026.09.1"

          port {
            name           = "grpc"
            container_port = 6566
          }

          resources {
            requests = {
              cpu    = "1"
              memory = "4Gi"
            }
            limits = {
              cpu    = "2"
              memory = "8Gi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/feast"
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "premium-rwo"

        resources {
          requests = {
            storage = "200Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_stateful_set_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "prometheus"
      "app.kubernetes.io/component" = "metrics"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    service_name = "prometheus"
    replicas     = 2

    selector {
      match_labels = {
        "app.kubernetes.io/name" = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "prometheus"
          "app.kubernetes.io/component" = "metrics"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.prometheus.metadata[0].name

        container {
          name  = "prometheus"
          image = "quay.io/prometheus/prometheus:v3.2.1"

          port {
            name           = "http"
            container_port = 9090
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2"
              memory = "8Gi"
            }
          }

          volume_mount {
            name       = "data"
            mount_path = "/prometheus"
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "premium-rwo"

        resources {
          requests = {
            storage = "500Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_daemon_set_v1" "otel_collector" {
  metadata {
    name      = "otel-collector"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name

    labels = {
      "app.kubernetes.io/name"      = "otel-collector"
      "app.kubernetes.io/component" = "telemetry"
      "app.kubernetes.io/part-of"   = "data-platform"
    }
  }

  spec {
    selector {
      match_labels = {
        "app.kubernetes.io/name" = "otel-collector"
      }
    }

    template {
      metadata {
        labels = {
          "app.kubernetes.io/name"      = "otel-collector"
          "app.kubernetes.io/component" = "telemetry"
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.otel_collector.metadata[0].name

        container {
          name  = "otel-collector"
          image = "otel/opentelemetry-collector-contrib:0.121.0"

          resources {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# Services and ingress.

resource "kubernetes_service_v1" "analytics_api" {
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name

    annotations = {
      "cloud.google.com/neg" = "{\"ingress\": true}"
    }
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "analytics-api"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }
  }
}

resource "kubernetes_service_v1" "feature_store" {
  metadata {
    name      = "feature-store"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }

  spec {
    type       = "ClusterIP"
    cluster_ip = "None"

    selector = {
      "app.kubernetes.io/name" = "feature-store"
    }

    port {
      name        = "grpc"
      port        = 6566
      target_port = 6566
    }
  }
}

resource "kubernetes_service_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  spec {
    type = "ClusterIP"

    selector = {
      "app.kubernetes.io/name" = "prometheus"
    }

    port {
      name        = "http"
      port        = 9090
      target_port = 9090
    }
  }
}

resource "kubernetes_ingress_v1" "analytics" {
  metadata {
    name      = "analytics"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name

    annotations = {
      "kubernetes.io/ingress.class"                   = "gce-internal"
      "kubernetes.io/ingress.regional-static-ip-name" = "analytics-internal"
    }
  }

  spec {
    rule {
      host = "analytics.data.internal"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.analytics_api.metadata[0].name

              port {
                number = 8080
              }
            }
          }
        }
      }
    }
  }
}

# Network policies: every namespace denies ingress by default; the feature store admits its clients.

resource "kubernetes_network_policy_v1" "batch" {
  metadata {
    name      = "default-deny-ingress"
    namespace = kubernetes_namespace_v1.batch.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy_v1" "analytics" {
  metadata {
    name      = "allow-feature-store-clients"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.batch.metadata[0].name
          }
        }
      }

      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.streaming.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_network_policy_v1" "streaming" {
  metadata {
    name      = "default-deny-ingress"
    namespace = kubernetes_namespace_v1.streaming.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]
  }
}

resource "kubernetes_network_policy_v1" "observability" {
  metadata {
    name      = "allow-scrape-targets"
    namespace = kubernetes_namespace_v1.observability.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = kubernetes_namespace_v1.analytics.metadata[0].name
          }
        }
      }
    }
  }
}

# Autoscaling.

resource "kubernetes_horizontal_pod_autoscaler_v1" "analytics_api" {
  metadata {
    name      = "analytics-api"
    namespace = kubernetes_namespace_v1.analytics.metadata[0].name
  }

  spec {
    min_replicas                      = 3
    max_replicas                      = 12
    target_cpu_utilization_percentage = 70

    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment_v1.analytics_api.metadata[0].name
    }
  }
}
