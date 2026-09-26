concept "dns-zone" {
  description = "A managed DNS namespace containing resource records."
}

concept "identity-group" {
  description = "A managed group principal used to assign access collectively."
}

concept "load-balancer" {
  description = "A load-balancing service composed from routing infrastructure."
}

concept "managed-secret" {
  description = "A managed secret identity whose sensitive value stays outside architecture output."
}

concept "message-queue" {
  description = "A managed queue buffering work or messages for asynchronous consumers."
}

concept "serverless-function" {
  description = "A managed event-driven function runtime."
}

concept "workflow" {
  description = "A managed workflow coordinating steps and service calls."
}

context "ownership" {
  description = "Administrative or lifecycle ownership."
}
