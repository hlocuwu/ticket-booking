variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  default     = "asia-southeast1"
  description = "GCP region"
}

variable "zone" {
  type        = string
  default     = "asia-southeast1-a"
  description = "GCP zone for GKE and Cloud SQL"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL admin password — pass via TF_VAR_db_password or -var"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  description = "JWT signing secret"
}

variable "smtp_username" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "sender_email" {
  type      = string
  sensitive = true
  default   = ""
}

variable "momo_access_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "momo_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "ghcr_token" {
  type        = string
  sensitive   = true
  description = "GitHub PAT with read:packages scope for GHCR pull"
}
