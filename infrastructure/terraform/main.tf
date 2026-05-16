terraform {
  required_version = ">= 1.6.0"
}

variable "project_name" {
  type    = string
  default = "intellidoc-ai"
}

output "deployment_note" {
  value = "Use this module as the cloud-specific entrypoint for VM, object storage, database, and DNS resources."
}
