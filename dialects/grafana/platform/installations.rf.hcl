concept "platform-installation" {
  description = "A product activation or installation supporting a Grafana Cloud stack."
}

rule "apps-productactivation-appo11yconfig-v1alpha1" {
  match {
    type = "grafana_apps_productactivation_appo11yconfig_v1alpha1"
  }

  as = concept.platform-installation
}

rule "apps-productactivation-dbo11yconfig-v1alpha1" {
  match {
    type = "grafana_apps_productactivation_dbo11yconfig_v1alpha1"
  }

  as = concept.platform-installation
}

rule "apps-productactivation-k8so11yconfig-v1alpha1" {
  match {
    type = "grafana_apps_productactivation_k8so11yconfig_v1alpha1"
  }

  as = concept.platform-installation
}

rule "apps-secret-keeper-activation-v1beta1" {
  match {
    type = "grafana_apps_secret_keeper_activation_v1beta1"
  }

  as = concept.platform-installation
}

rule "cloud-plugin-installation" {
  match {
    type = "grafana_cloud_plugin_installation"
  }

  as = concept.platform-installation

  contribution {
    to       = concept.observability-tenant
    via      = source.stack_slug
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.slug
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "k6-installation" {
  match {
    type = "grafana_k6_installation"
  }

  as = concept.platform-installation

  contribution {
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}

rule "synthetic-monitoring-installation" {
  match {
    type = "grafana_synthetic_monitoring_installation"
  }

  as = concept.platform-installation

  contribution {
    to       = concept.observability-tenant
    via      = source.stack_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }

    # Shared observability-tenant instances can be provisioned by a separate configuration.
    external = "allow"
  }
}
