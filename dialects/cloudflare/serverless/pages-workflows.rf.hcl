concept "pages-project" {
  description = "A Cloudflare Pages application project."
}

concept "pages-domain" {
  description = "A custom domain serving a Cloudflare Pages project."
}




rule "pages-project" {
  match {
    type = "cloudflare_pages_project"
  }

  as = concept.pages-project

  identity {
    attributes = ["name"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id", "name"]
  }
}

rule "pages-domain" {
  match {
    type = "cloudflare_pages_domain"
  }

  as = concept.pages-domain

  contribution {
    to       = concept.pages-project
    via      = source.project_name
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.name
      strategy = "exact"
    }
  }
}
