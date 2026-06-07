resource "google_sql_database_instance" "postgres" {
  name             = "${var.project_id}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  depends_on = [var.private_services_connection]

  settings {
    tier = var.tier

    availability_type = "ZONAL"

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = false
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "ticket_db" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

# Staging database — separate DB within same instance, reuses same user/password
resource "google_sql_database" "ticket_db_staging" {
  name     = "${var.db_name}_staging"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "ticket_admin" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}
