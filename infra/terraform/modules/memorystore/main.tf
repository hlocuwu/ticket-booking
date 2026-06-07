resource "google_redis_instance" "redis" {
  name           = "${var.project_id}-redis"
  tier           = "BASIC"
  memory_size_gb = var.memory_size_gb
  region         = var.region

  authorized_network = var.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_version = "REDIS_7_0"

  labels = {
    env = "prod"
  }
}
