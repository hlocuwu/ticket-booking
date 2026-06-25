# Create all app secrets in GCP Secret Manager
# Values are set here from Terraform variables — never committed to git

locals {
  app_secrets = {
    "ticket-booking-db-password"     = var.db_password
    "ticket-booking-jwt-secret"      = var.jwt_secret
    "ticket-booking-smtp-username"   = var.smtp_username
    "ticket-booking-smtp-password"   = var.smtp_password
    "ticket-booking-sender-email"    = var.sender_email
    "ticket-booking-momo-access-key" = var.momo_access_key
    "ticket-booking-momo-secret-key" = var.momo_secret_key
    "ticket-booking-ghcr-token"      = var.ghcr_token
  }
}

resource "google_secret_manager_secret" "app_secrets" {
  for_each  = local.app_secrets
  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "app_secrets" {
  for_each    = local.app_secrets
  secret      = google_secret_manager_secret.app_secrets[each.key].id
  secret_data = each.value
}
