variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "network_id" {
  type = string
}

variable "private_services_connection" {
  description = "Dependency on private services networking connection"
  type        = string
}

variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_name" {
  type    = string
  default = "ticket_db"
}

variable "db_user" {
  type    = string
  default = "ticket_admin"
}

variable "db_password" {
  type      = string
  sensitive = true
}
