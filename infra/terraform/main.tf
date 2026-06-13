provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required GCP APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "iam.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

module "vpc" {
  source     = "./modules/vpc"
  project_id = var.project_id
  region     = var.region

  depends_on = [google_project_service.apis]
}

module "gke" {
  source       = "./modules/gke"
  project_id   = var.project_id
  zone         = var.zone
  network_name = module.vpc.network_name
  subnet_name  = module.vpc.subnet_name

  depends_on = [module.vpc]
}

module "cloudsql" {
  source     = "./modules/cloudsql"
  project_id = var.project_id
  region     = var.region
  network_id = module.vpc.network_id
  db_password = var.db_password

  private_services_connection = module.vpc.private_services_connection

  depends_on = [module.vpc]
}

module "memorystore" {
  source     = "./modules/memorystore"
  project_id = var.project_id
  region     = var.region
  network_id = module.vpc.network_id

  depends_on = [module.vpc]
}

module "iam" {
  source     = "./modules/iam"
  project_id = var.project_id

  # Workload Identity pool is created by GKE — must wait for cluster
  depends_on = [google_project_service.apis, module.gke]
}
