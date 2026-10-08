terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.62.0"
    }
  }
}

resource "aws_vpc" "hub" {

  cidr_block = "10.0.0.0/16"

}
resource "aws_vpc" "workloads" {

  cidr_block = "10.1.0.0/16"

}
resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.workloads.id
  cidr_block = "10.1.0.0/24"
}

resource "aws_subnet" "private" {
  vpc_id     = aws_vpc.workloads.id
  cidr_block = "10.1.1.0/24"
}

resource "aws_route_table" "private" {

  vpc_id = aws_vpc.workloads.id

}
resource "aws_security_group" "workloads" {
  name   = "workloads"
  vpc_id = aws_vpc.workloads.id
}

resource "aws_network_acl" "workloads" {

  vpc_id = aws_vpc.workloads.id

}
resource "aws_internet_gateway" "public" {

  vpc_id = aws_vpc.workloads.id

}
resource "aws_nat_gateway" "egress" {

  subnet_id = aws_subnet.public.id

}
resource "aws_vpc_peering_connection" "hub_to_workloads" {
  vpc_id      = aws_vpc.hub.id
  peer_vpc_id = aws_vpc.workloads.id
}

resource "aws_vpn_gateway" "vpn" {

  vpc_id = aws_vpc.hub.id

}
resource "aws_vpn_connection" "private" {
  type                = "ipsec.1"
  customer_gateway_id = "fx-private-customer-gateway-id"
  vpn_gateway_id      = aws_vpn_gateway.vpn.id
}

resource "aws_dx_connection" "direct" {
  location  = "westeurope"
  bandwidth = "1Gbps"
  name      = "direct"
}

resource "aws_ec2_transit_gateway" "hub" {

  description = "hub"

}
resource "aws_ec2_transit_gateway_vpc_attachment" "workloads" {
  transit_gateway_id = aws_ec2_transit_gateway.hub.id
  vpc_id             = aws_vpc.workloads.id
  subnet_ids         = [aws_subnet.private.id]
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.workloads.id
  service_name = "com.amazonaws.synthetic.s3"
}

resource "aws_instance" "api" {
  instance_type = "fx-api-instance-type"
  ami           = "ami-synthetic"
  subnet_id     = aws_subnet.private.id
}

resource "aws_autoscaling_group" "workers" {
  launch_configuration = "fx-workers-launch-configuration"
  min_size             = 1
  max_size             = 1
  name                 = "workers"
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
    max_size     = 1
    desired_size = 1
    min_size     = 1
  }
  node_role_arn = "arn:aws:iam::123456789012:role/fx-system-node-role-arn"
  subnet_ids    = ["fx-system-subnet-ids"]
  cluster_name  = aws_eks_cluster.workloads.name
}

resource "aws_eks_fargate_profile" "jobs" {
  selector {
    namespace = "fx-jobs-namespace"
  }
  fargate_profile_name   = "fx-jobs-fargate-profile-name"
  pod_execution_role_arn = "arn:aws:iam::123456789012:role/fx-jobs-pod-execution-role-arn"
  cluster_name           = aws_eks_cluster.workloads.name
}

resource "aws_ecs_cluster" "services" {

  name = "services"

}
resource "aws_ecs_service" "api" {
  name        = "api"
  cluster     = aws_ecs_cluster.services.id
  launch_type = "FARGATE"
}

resource "aws_lb" "public" {
  subnet_mapping {
    subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-public-subnet-id"
  }
  name = "public"
}

resource "aws_lb_listener" "https" {
  default_action {
    target_group_arn = aws_lb_target_group.api.arn
    type = "forward"
  }
  load_balancer_arn = aws_lb.public.arn
  port              = 443
}

resource "aws_lb_target_group" "api" {
  vpc_id = aws_vpc.workloads.id
  protocol = "HTTP"
  port = 8080

  name = "api"

}
resource "aws_globalaccelerator_accelerator" "global" {

  name = "global"

}
resource "aws_globalaccelerator_listener" "global" {
  protocol = "TCP"
  port_range {
  }
  accelerator_arn = aws_globalaccelerator_accelerator.global.id
}

resource "aws_globalaccelerator_endpoint_group" "global" {

  listener_arn = aws_globalaccelerator_listener.global.id

}
resource "aws_db_instance" "orders" {
  instance_class = "fx-orders-instance-class"
  identifier     = "orders"
}

resource "aws_rds_cluster" "aurora" {
  engine             = "aurora-mysql"
  cluster_identifier = "aurora"
}

resource "aws_rds_cluster_instance" "aurora_reader" {
  instance_class     = "fx-aurora-reader-instance-class"
  engine             = "aurora-mysql"
  cluster_identifier = aws_rds_cluster.aurora.id
}

resource "aws_rds_cluster_endpoint" "aurora_readers" {
  custom_endpoint_type        = "READER"
  cluster_endpoint_identifier = "fx-aurora-readers-cluster-endpoint-identifier"
  cluster_identifier          = aws_rds_cluster.aurora.id
}

resource "aws_rds_cluster_activity_stream" "aurora" {
  mode         = "sync"
  kms_key_id   = "fx-aurora-kms-key-id"
  resource_arn = aws_rds_cluster.aurora.arn
}

resource "aws_db_proxy" "orders" {
  vpc_subnet_ids = ["fixture"]
  role_arn       = "arn:aws:iam::123456789012:role/fx-orders-role-arn"
  engine_family  = "MYSQL"
  name           = "orders"
}

resource "aws_db_proxy_default_target_group" "orders" {

  db_proxy_name = aws_db_proxy.orders.name

}
resource "aws_db_proxy_endpoint" "orders" {
  vpc_subnet_ids         = ["fx-orders-vpc-subnet-ids"]
  db_proxy_endpoint_name = "fx-orders-db-proxy-endpoint-name"
  db_proxy_name          = aws_db_proxy.orders.name
}

resource "aws_dynamodb_table" "sessions" {

  name = "sessions"

}
resource "aws_dynamodb_global_secondary_index" "sessions_by_owner" {
  key_schema {
    key_type       = "HASH"
    attribute_type = "S"
    attribute_name = "owner"
  }
  index_name = "by-owner"
  table_name = aws_dynamodb_table.sessions.name
}

resource "aws_elasticache_replication_group" "cache" {
  description          = "fx-cache-description"
  replication_group_id = "cache"
}

resource "aws_opensearch_domain" "search" {

  domain_name = "search"

}
resource "aws_s3_bucket" "data" {

  bucket = "rootform-synthetic-data"

}
resource "aws_s3_bucket_versioning" "data" {
  versioning_configuration {
    status = "Enabled"
  }
  bucket = aws_s3_bucket.data.id
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  rule {
  }
  bucket = aws_s3_bucket.data.id
}

resource "aws_cloudfront_distribution" "edge" {
  viewer_certificate {
  }
  restrictions {
    geo_restriction {
      restriction_type = "blacklist"
    }
  }
  origin {
    origin_id   = "fx-edge-origin-id"
    domain_name = "fx-edge-domain-name"
  }
  default_cache_behavior {
    viewer_protocol_policy = "allow-all"
    target_origin_id       = "fx-edge-target-origin-id"
    cached_methods         = ["fixture"]
    allowed_methods        = ["fixture"]
  }
  enabled = true
}

resource "aws_sns_topic" "events" {

  name = "events"

}
resource "aws_sqs_queue" "analytics" {

  name = "analytics"

}
resource "aws_sns_topic_subscription" "analytics" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.analytics.arn
}

resource "aws_cloudwatch_event_bus" "platform" {

  name = "platform"

}
resource "aws_cloudwatch_event_rule" "orders" {
  event_pattern  = jsonencode({ source = ["fixture.events"] })
  name           = "orders"
  event_bus_name = aws_cloudwatch_event_bus.platform.name
}

resource "aws_cloudwatch_event_target" "orders" {
  rule = aws_cloudwatch_event_rule.orders.name
  arn  = aws_sqs_queue.analytics.arn
}

resource "aws_kinesis_stream" "telemetry" {
  shard_count = 1

  name = "telemetry"

}
resource "aws_msk_cluster" "streaming" {
  number_of_broker_nodes = 1
  kafka_version          = "fx-streaming-kafka-version"
  broker_node_group_info {
    security_groups = ["fixture"]
    instance_type   = "fx-streaming-instance-type"
    client_subnets  = ["fixture"]
  }
  cluster_name = "streaming"
}

resource "aws_api_gateway_rest_api" "public" {

  name = "public"

}
resource "aws_api_gateway_resource" "orders" {
  path_part   = "fx-orders-path-part"
  parent_id   = "fx-orders-parent-id"
  rest_api_id = aws_api_gateway_rest_api.public.id
}

resource "aws_api_gateway_stage" "production" {
  deployment_id = "fx-production-deployment-id"
  rest_api_id   = aws_api_gateway_rest_api.public.id
  stage_name    = "production"
}

resource "aws_api_gateway_integration" "orders" {
  type        = "HTTP"
  http_method = "ANY"
  rest_api_id = aws_api_gateway_rest_api.public.id
  resource_id = aws_api_gateway_resource.orders.id
}

resource "aws_api_gateway_model" "orders" {
  name         = "fx-orders-name"
  content_type = "fx-orders-content-type"
  rest_api_id  = aws_api_gateway_rest_api.public.id
}

resource "aws_apigatewayv2_api" "realtime" {
  name          = "realtime"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_model" "realtime" {
  schema       = jsonencode({ fixture = true })
  content_type = "fx-realtime-content-type"
  api_id       = aws_apigatewayv2_api.realtime.id
  name         = "realtime"
}

resource "aws_appsync_graphql_api" "graphql" {
  authentication_type = "API_KEY"
  name                = "graphql"
}

resource "aws_appsync_datasource" "orders" {
  api_id = aws_appsync_graphql_api.graphql.id
  name   = "orders"
  type   = "AWS_LAMBDA"
}

resource "aws_appsync_function" "orders" {
  data_source = "fx-orders-data-source"
  api_id      = aws_appsync_graphql_api.graphql.id
  name        = "orders"
}

resource "aws_appsync_resolver" "orders" {
  api_id = aws_appsync_graphql_api.graphql.id
  type   = "Query"
  field  = "orders"
}

resource "aws_lambda_function" "orders" {
  runtime = "nodejs20.x"
  handler = "index.handler"
  filename      = "fx-orders-filename"
  role          = "arn:aws:iam::123456789012:role/fx-orders-role"
  function_name = "orders"
}

resource "aws_iam_role" "runtime" {
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { Service = "ec2.amazonaws.com" } }] })
  name               = "runtime"
}

resource "aws_iam_role_policy_attachment" "runtime" {
  role       = aws_iam_role.runtime.name
  policy_arn = "arn:aws:iam::aws:policy/synthetic"
}

resource "aws_iam_instance_profile" "runtime" {
  name = "runtime"
  role = aws_iam_role.runtime.name
}

resource "aws_kms_key" "data" {

  description = "data"

}
resource "aws_kms_alias" "data" {
  name          = "alias/data"
  target_key_id = aws_kms_key.data.id
}

resource "aws_secretsmanager_secret" "database" {

  name = "database"

}
resource "aws_ecr_repository" "api" {

  name = "api"

}
resource "aws_ecr_lifecycle_policy" "api" {
  policy     = jsonencode({})
  repository = aws_ecr_repository.api.name
}

resource "aws_redshift_cluster" "warehouse" {
  node_type          = "fx-warehouse-node-type"
  cluster_identifier = "warehouse"
}

resource "aws_glue_catalog_database" "lake" {

  name = "lake"

}
resource "aws_emr_cluster" "analytics" {
  service_role  = "fx-analytics-service-role"
  release_label = "fx-analytics-release-label"
  name          = "analytics"
}

resource "aws_emr_instance_group" "analytics" {
  instance_type = "fx-analytics-instance-type"
  cluster_id    = aws_emr_cluster.analytics.id
}

resource "aws_athena_workgroup" "analytics" {

  name = "analytics"

}
resource "aws_sagemaker_endpoint" "inference" {
  endpoint_config_name = "fx-inference-endpoint-config-name"
  name                 = "inference"
}

resource "aws_bedrock_guardrail" "generative_ai" {
  blocked_outputs_messaging = "fx-generative-ai-blocked-outputs-messaging"
  blocked_input_messaging   = "fx-generative-ai-blocked-input-messaging"
  name                      = "generative-ai"
}

resource "aws_bedrockagent_agent" "generative_ai" {
  foundation_model        = "fx-generative-ai-foundation-model"
  agent_resource_role_arn = "arn:aws:iam::123456789012:role/fx-generative-ai-agent-resource-role-arn"
  agent_name              = "generative-ai"
}

resource "aws_bedrockagent_agent_action_group" "orders" {
  agent_version     = "fx-orders-agent-version"
  action_group_name = "fx-orders-action-group-name"
  agent_id          = aws_bedrockagent_agent.generative_ai.id
}

resource "aws_cognito_user_pool" "identity" {

  name = "identity"

}
resource "aws_cognito_user_group" "operators" {
  name         = "fx-operators-name"
  user_pool_id = aws_cognito_user_pool.identity.id
}

resource "aws_connect_instance" "support" {
  directory_id             = "fx-support-d"
  outbound_calls_enabled   = false
  inbound_calls_enabled    = false
  identity_management_type = "CONNECT_MANAGED"
}

resource "aws_connect_queue" "support" {
  hours_of_operation_id = "fx-support-hours-of-operation-id"
  instance_id           = aws_connect_instance.support.id
  name                  = "support"
}

resource "aws_pinpoint_app" "notifications" {

  name = "notifications"

}
resource "aws_pinpoint_sms_channel" "notifications" {

  application_id = aws_pinpoint_app.notifications.application_id

}
resource "aws_cloudwatch_log_group" "platform" {

  name = "platform"

}
resource "aws_xray_group" "tracing" {
  filter_expression = "fx-tracing-filter-expression"
  group_name        = "tracing"
}

resource "aws_organizations_organization" "platform" {

}
resource "aws_controltower_landing_zone" "platform" {
  manifest_json = jsonencode({})
  version       = "4.0"
}
