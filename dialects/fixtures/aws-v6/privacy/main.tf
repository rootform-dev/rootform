terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_instance" "private" {
  instance_type = "fx-private-instance-type"
  ami           = "ami-synthetic"
  user_data     = "rootform-user-data-secret-sentinel"
}

resource "aws_iam_role" "private" {
  name               = "private"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" }, Condition = { StringEquals = { "aws:PrincipalTag/marker" = "rootform-iam-policy-secret-sentinel" } } }] })
}

resource "aws_kms_key" "private" {
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "s3:GetObject", Resource = "*", Principal = { AWS = "arn:aws:iam::123456789012:root" }, Condition = { StringEquals = { "aws:PrincipalTag/marker" = "rootform-kms-policy-secret-sentinel" } } }] })
}

resource "aws_secretsmanager_secret" "private" {
  name        = "private"
  description = "rootform-secret-value-sentinel"
}
