terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
    vault = {
      source  = "hashicorp/vault"
      version = "5.11.0"
    }
  }
}

# Reads of this provider need its API, so the plan defers them until apply.
resource "terraform_data" "defer_reads" {
}
variable "choose_first" {
  type    = bool
  default = true
}

resource "aws_iam_role" "first" {
  assume_role_policy = jsonencode({})
  name               = "rootform-vault-first"
}

resource "aws_iam_role" "second" {
  assume_role_policy = jsonencode({})
  name               = "rootform-vault-second"
}

resource "aws_s3_bucket" "mismatch" {

  bucket = "rootform-vault-mismatch"

}
resource "vault_namespace" "literal" {
  namespace  = "platform"
  path       = "literal"
  depends_on = [aws_iam_role.first]
}

resource "vault_aws_secret_backend" "literal" {
  path       = "aws-literal"
  role_arn   = "arn:aws:iam::123456789012:role/literal"
  depends_on = [aws_iam_role.first]
}

resource "vault_aws_secret_backend" "ambiguous" {
  path     = "aws-ambiguous"
  role_arn = var.choose_first ? aws_iam_role.first.arn : aws_iam_role.second.arn
}

resource "vault_aws_secret_backend" "mismatch" {
  path     = "aws-mismatch"
  role_arn = aws_s3_bucket.mismatch.arn
}

resource "vault_generic_secret" "payload" {
  path = "kv/private"
  data_json = jsonencode({
    password = "ROOTFORM_VAULT_BOUNDARY_SECRET_SENTINEL"
    token    = "ROOTFORM_VAULT_BOUNDARY_TOKEN_SENTINEL"
  })
}

resource "vault_generic_endpoint" "arbitrary" {
  path      = "sys/private"
  data_json = jsonencode({ value = "ROOTFORM_VAULT_GENERIC_ENDPOINT_SENTINEL" })
}

data "vault_generic_secret" "payload" {
  depends_on = [terraform_data.defer_reads]
  path       = vault_generic_secret.payload.path
}

# The mount path is unknown until apply, so Terraform defers opening the
# ephemeral resource instead of contacting Vault during plan.
resource "terraform_data" "kv_mount" {
  input = "kv"
}

ephemeral "vault_kv_secret_v2" "session" {
  mount = terraform_data.kv_mount.output
  name  = "ROOTFORM_VAULT_EPHEMERAL_SENTINEL"
}
