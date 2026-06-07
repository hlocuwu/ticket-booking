output "gke_cluster_name" {
  value       = module.gke.cluster_name
  description = "GKE cluster name — use with: gcloud container clusters get-credentials"
}

output "cloudsql_private_ip" {
  value       = module.cloudsql.private_ip
  description = "Cloud SQL private IP — set as db.host in values-prod.yaml"
}

output "redis_host" {
  value       = module.memorystore.host
  description = "Memorystore Redis host — set as redis.host in values-prod.yaml"
}

output "redis_port" {
  value = module.memorystore.port
}

output "eso_service_account_email" {
  value       = module.iam.eso_service_account_email
  description = "GSA email for External Secrets Operator Workload Identity"
}
