terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "application" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.20.1.0/24"
}

resource "aws_sns_topic" "events" {}

resource "aws_sns_topic_subscription" "events" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "https"
  endpoint  = "https://example.com/events"
}

resource "aws_s3_bucket" "assets" {
  bucket = "rootform-docs-assets"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}
