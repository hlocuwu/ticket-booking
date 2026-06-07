# Google Service Account for External Secrets Operator
resource "google_service_account" "eso" {
  account_id   = "ticket-booking-eso"
  display_name = "External Secrets Operator — Secret Manager access"
}

# Allow ESO GSA to read secrets
resource "google_project_iam_member" "eso_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.eso.email}"
}

# Workload Identity binding: KSA external-secrets/external-secrets → GSA ticket-booking-eso
resource "google_service_account_iam_member" "eso_workload_identity" {
  service_account_id = google_service_account.eso.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[external-secrets/external-secrets]"
}
