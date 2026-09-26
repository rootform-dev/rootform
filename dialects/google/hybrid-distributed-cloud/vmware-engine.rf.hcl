



rule "vmware-engine-network" {
  match {
    type = "google_vmwareengine_network"
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

rule "vmware-engine-subnet" {
  match {
    type = "google_vmwareengine_subnet"
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
