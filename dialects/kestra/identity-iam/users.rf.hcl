concept "user-account" {
  description = "A Kestra user account."
}

concept "user-credential" {
  description = "A basic-auth credential attached to a Kestra user."
}

rule "user" {
  match {
    type = "kestra_user"
  }

  as = concept.user-account

  identity {
    attributes = ["id"]
    scope      = "provider"
  }

  endpoint {
    attributes = ["id"]
  }
}

rule "user-password" {
  match {
    type = "kestra_user_password"
  }

  as = concept.user-credential

  contribution {
    to       = concept.user-account
    via      = source.user_id
    on_null  = "absent"
    on_empty = "absent"

    match {
      by       = target.id
      strategy = "exact"
    }
  }
}
