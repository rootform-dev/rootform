terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "2.16.0"
    }
  }
}

resource "mongodbatlas_organization" "platform" {

  name = "Rootform"

}
resource "mongodbatlas_project" "application" {
  name   = "application"
  org_id = mongodbatlas_organization.platform.id
}

resource "mongodbatlas_advanced_cluster" "primary" {
  replication_specs = [{
    region_configs = [{
      provider_name   = "AWS"
      region_name     = "US_EAST_1"
      priority        = 7
      electable_specs = { instance_size = "M10", node_count = 3 }
    }]
  }]
  cluster_type = "REPLICASET"
  project_id   = mongodbatlas_project.application.id
  name         = "primary"
}

resource "mongodbatlas_cloud_backup_snapshot_export_bucket" "archive" {
  cloud_provider = "fx-archive-cloud-provider"
  bucket_name    = "fx-archive-bucket-name"
  project_id     = mongodbatlas_project.application.id
}

resource "mongodbatlas_cloud_backup_schedule" "primary" {
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name

  export {
    export_bucket_id = mongodbatlas_cloud_backup_snapshot_export_bucket.archive.id
  }
}

resource "mongodbatlas_search_deployment" "primary" {
  specs        = [{ instance_size = "S20_HIGHCPU_NVME", node_count = 2 }]
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name
}

resource "mongodbatlas_online_archive" "orders" {
  db_name = "fx-orders-db-name"
  criteria {
    type = "DATE"
  }
  coll_name    = "fx-orders-coll-name"
  project_id   = mongodbatlas_project.application.id
  cluster_name = mongodbatlas_advanced_cluster.primary.name
}

resource "mongodbatlas_stream_workspace" "events" {
  workspace_name      = "fx-events-workspace-name"
  data_process_region = { cloud_provider = "AWS", region = "VIRGINIA_USA" }
  project_id          = mongodbatlas_project.application.id
}

resource "mongodbatlas_stream_processor" "orders" {
  project_id     = mongodbatlas_project.application.id
  workspace_name = mongodbatlas_stream_workspace.events.workspace_name
  processor_name = "orders"
  pipeline       = jsonencode([{ "$source" = { connectionName = "ROOTFORM_ATLAS_PIPELINE_SENTINEL" } }])
}
