
rule "edge-network" {
  match {
    type = "google_edgenetwork_network"
  }

  as = rf.concept.virtual-network

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "edge-network-subnet" {
  match {
    type = "google_edgenetwork_subnet"
  }

  as = rf.concept.subnet

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}
