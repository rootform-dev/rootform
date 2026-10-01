---
title: "Understand composition"
description: "Follow a load balancer's implementation members while preserving each instance and unresolved evidence."
---

Some architectural objects are implemented by several Terraform instances.
The Google application load balancer starts at a forwarding rule, follows its
HTTPS proxy, then its URL map and default backend service. Composition records
those parts on each root instance instead of guessing a group from their names.

This is the official
[application load balancer Rule](../../../dialects/google/load-balancing/application-load-balancer.rf.hcl):

```rf title="google/load-balancing/application-load-balancer.rf.hcl"
rule "application-load-balancer" {
  match {
    type = "google_compute_global_forwarding_rule"
  }

  as = concept.load-balancer

  composition {
    member "target-https-proxy" {
      via = source.target

      match {
        type = "google_compute_target_https_proxy"
      }
    }

    member "url-map" {
      via = member.target-https-proxy.url_map

      match {
        type = "google_compute_url_map"
      }
    }

    member "backend-service" {
      via = member.url-map.default_service

      match {
        type = "google_compute_backend_service"
      }
    }
  }
}
```

The Google Dialect defines the local `concept.load-balancer`. The root's `as`
classifies the forwarding-rule instance; members do not inherit that Concept.

## Follow the evidence in order

`source.target` reads the root's target. Once `target-https-proxy` is established,
`member.target-https-proxy.url_map` reads that member to find the next one.
Inside a member's `match.where`, however, `source` means the candidate member.

Known values can match the identity attributes of Rules interpreting member
candidates. A verified saved-plan reference can establish a member whose own
type has no Rule, specifically through its `id` endpoint. That exception serves
composition; an ordinary fact target still needs an applied Rule satisfying
`to`. Members are resolved independently for each root instance and stage.

## Keep unresolved parts visible

If the proxy cannot be established, its dependent URL map and backend service
remain unresolved. An independent later member may still resolve. The root
keeps its Rule, classification and emissions, alongside member reasons.

Every member keeps its own Representation. Composition does not emit a Relation,
apply the root Rule to its members, or merge their identities. Use a separate
emission when evidence also supports a distinct architectural connection.
RF has no optional member or alternative-member syntax.

See [Composition reference](../reference/composition.md) for member order,
matching and reasons. [Policies over facts](policies.md) explains which
architectural facts Policies can query; composition is not a Policy query.
