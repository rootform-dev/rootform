data "vault_generic_secret" "runtime" {
  depends_on = [terraform_data.defer_reads]
  path       = "ROOTFORM_SECRET_PATH_SENTINEL"
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
resource "random_password" "automation" {
  length  = 32
  special = true
}

resource "vault_generic_secret" "managed" {
  path = "rootform/synthetic/managed"
  data_json = jsonencode({
    token  = random_password.automation.result
    marker = "ROOTFORM_SECRET_VALUE_SENTINEL"
  })
}
