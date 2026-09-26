resource "kestra_tenant" "unsupported" {
  tenant_id = "unsupported"
}
resource "vault_mount" "configured" {
  path = "configured"
  type = "kv"
}

resource "random_id" "unsupported" {

  byte_length = 8

}