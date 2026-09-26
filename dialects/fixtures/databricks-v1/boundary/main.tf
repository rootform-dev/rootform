terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
    databricks = {
      source  = "databricks/databricks"
      version = "1.129.0"
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

resource "aws_vpc" "first" {

  cidr_block = "10.60.0.0/16"

}
resource "aws_vpc" "second" {

  cidr_block = "10.70.0.0/16"

}
resource "aws_s3_bucket" "first" {

  bucket = "rootform-first"

}
resource "aws_s3_bucket" "second" {

  bucket = "rootform-second"

}
resource "aws_iam_role" "first" {
  name               = "first"
  assume_role_policy = "{}"
}

resource "aws_iam_role" "second" {
  name               = "second"
  assume_role_policy = "{}"
}

resource "databricks_mws_networks" "literal" {
  account_id         = "account"
  network_name       = "literal"
  vpc_id             = "vpc-literal"
  subnet_ids         = ["subnet-literal-a", "subnet-literal-b"]
  security_group_ids = ["sg-literal"]
}

resource "databricks_mws_networks" "ambiguous" {
  account_id         = "account"
  network_name       = "ambiguous"
  vpc_id             = var.choose_first ? aws_vpc.first.id : aws_vpc.second.id
  subnet_ids         = ["subnet-ambiguous-a", "subnet-ambiguous-b"]
  security_group_ids = ["sg-ambiguous"]
}

resource "databricks_storage_credential" "literal" {
  name = "literal"

  aws_iam_role {
    role_arn = "arn:aws:iam::000000000000:role/literal"
  }
}

resource "databricks_storage_credential" "ambiguous" {
  name = "ambiguous"

  aws_iam_role {
    role_arn = var.choose_first ? aws_iam_role.first.arn : aws_iam_role.second.arn
  }
}

resource "databricks_external_location" "literal" {
  name            = "literal"
  credential_name = databricks_storage_credential.literal.name
  url             = "s3://literal/path"
}

resource "databricks_external_location" "ambiguous" {
  name            = "ambiguous"
  credential_name = databricks_storage_credential.ambiguous.name
  url             = var.choose_first ? aws_s3_bucket.first.id : aws_s3_bucket.second.id
  depends_on      = [aws_vpc.first, aws_vpc.second]
}

resource "databricks_secret_scope" "boundary" {

  name = "boundary"

}
resource "databricks_secret" "boundary" {
  scope        = databricks_secret_scope.boundary.name
  key          = "token"
  string_value = "ROOTFORM_DATABRICKS_BOUNDARY_SECRET"
}

resource "databricks_notebook" "operational" {
  path           = "/Shared/operational"
  language       = "PYTHON"
  content_base64 = base64encode("ROOTFORM_DATABRICKS_BOUNDARY_NOTEBOOK")
}

resource "databricks_token" "credential" {

  comment = "ROOTFORM_DATABRICKS_BOUNDARY_TOKEN"

}
resource "databricks_user" "human" {

  user_name = "person@example.com"

}
data "databricks_cluster" "lookup" {
  depends_on = [terraform_data.defer_reads]
  cluster_id = "cluster-literal"
}
