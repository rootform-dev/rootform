terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

variable "vpc_id" {
  type    = string
  default = "vpc-0fixture"
}

resource "aws_vpc" "known" {

  cidr_block = "10.0.0.0/16"

}
resource "aws_subnet" "dynamic" {
  vpc_id = var.vpc_id
}
resource "aws_instance" "literal" {
  instance_type = "fx-literal-instance-type"
  ami           = "ami-synthetic"
  subnet_id     = "subnet-literal"
}

resource "aws_instance" "dependency_only" {
  instance_type = "fx-dependency-only-instance-type"
  ami           = "ami-synthetic"
  depends_on    = [aws_subnet.dynamic]
}

resource "aws_sns_topic" "events" {

  name = "events"

}
resource "aws_sns_topic_subscription" "literal" {
  topic_arn = "arn:aws:sns:us-east-1:123456789012:fx-literal-topic-arn"
  protocol  = "sqs"
  endpoint  = "arn:aws:sqs:synthetic:999988887777:literal"
}

resource "aws_s3_bucket_policy" "helper" {
  bucket = "literal"
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "s3:GetObject", Resource = "*", Principal = { AWS = "arn:aws:iam::123456789012:root" }, Condition = { StringEquals = { "aws:PrincipalTag/marker" = "rootform-policy-sentinel" } } }] })
}

resource "aws_iam_user_ssh_key" "credential" {
  username   = "synthetic"
  encoding   = "SSH"
  public_key = "ssh-ed25519 rootform-public-key-sentinel"
}

resource "aws_lb_listener_certificate" "listener_configuration" {
  listener_arn    = "arn:aws:iam::123456789012:role/fx-listener-configuration-listener-arn"
  certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/fx-listener-configuration-certificate-arn"
}

resource "aws_rds_export_task" "operation" {
  s3_bucket_name         = "fx-operation-s3-bucket-name"
  iam_role_arn           = "arn:aws:iam::123456789012:role/fx-operation-iam-role-arn"
  kms_key_id             = "fx-operation-kms-key-id"
  source_arn             = "arn:aws:iam::123456789012:role/fx-operation-source-arn"
  export_task_identifier = "fx-operation-export-task-identifier"

}
resource "aws_sagemaker_training_job" "operation" {
  role_arn          = "arn:aws:iam::123456789012:role/fx-operation-role-arn"
  training_job_name = "fx-operation-training-job-name"

}
# The inline schema spares the provider a CloudFormation lookup while planning.
resource "aws_cloudcontrolapi_resource" "opaque" {
  type_name     = "Synthetic::Unknown::Resource"
  desired_state = jsonencode({ Marker = "rootform-cloudcontrol-sentinel" })
  schema = jsonencode({
    typeName             = "Synthetic::Unknown::Resource"
    description          = "Opaque resource type used by the boundary fixture"
    additionalProperties = false
    primaryIdentifier    = ["/properties/Marker"]
    properties = {
      Marker = { type = "string" }
    }
  })
}

action "aws_lambda_invoke" "imperative" {
  config {
    function_name = "literal"
    payload       = jsonencode({})
  }
}
