variable "project_id" {
  type = string
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"
}

variable "network_name" {
  type = string
}

variable "subnet_name" {
  type = string
}

variable "node_count" {
  type    = number
  default = 3
}

variable "machine_type" {
  type    = string
  default = "e2-standard-2"
}
