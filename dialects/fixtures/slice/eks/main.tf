terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_eks_cluster" "workloads" {
  vpc_config {
    subnet_ids = ["fixture"]
  }
  role_arn = "arn:aws:iam::123456789012:role/fx-workloads-role-arn"
  name     = "workloads"
}

resource "aws_eks_node_group" "system" {
  scaling_config {
    min_size     = 1
    max_size     = 1
    desired_size = 1
  }
  subnet_ids    = ["fx-system-subnet-ids"]
  node_role_arn = "arn:aws:iam::123456789012:role/fx-system-node-role-arn"
  cluster_name  = aws_eks_cluster.workloads.name
}

resource "aws_eks_fargate_profile" "jobs" {
  selector {
    namespace = "fx-jobs-namespace"
  }
  pod_execution_role_arn = "arn:aws:iam::123456789012:role/fx-jobs-pod-execution-role-arn"
  fargate_profile_name   = "fx-jobs-fargate-profile-name"
  cluster_name           = aws_eks_cluster.workloads.name
}
