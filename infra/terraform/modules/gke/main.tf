resource "google_container_cluster" "primary" {
  name     = "${var.project_id}-gke"
  location = var.zone

  network    = var.network_name
  subnetwork = var.subnet_name

  # Remove default node pool — we manage our own
  remove_default_node_pool = true
  initial_node_count       = 1

  # Workload Identity — allows pods to use GCP IAM via KSA
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Disable basic auth
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  deletion_protection = false
}

resource "google_container_node_pool" "primary" {
  name       = "primary-pool"
  location   = var.zone
  cluster    = google_container_cluster.primary.name
  node_count = var.node_count

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = 50
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    # Workload Identity on node pool
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      env = "prod"
    }
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}
