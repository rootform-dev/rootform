terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "= 5.3.0" }
  }
}

resource "terraform_data" "unknown_group" {

}
resource "azurerm_resource_group" "compute" {
  name     = "compute"
  location = "West Europe"
}

resource "azurerm_linux_virtual_machine" "linux" {
  source_image_id                 = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-image"
  disable_password_authentication = false
  admin_password                  = "Fx-Placeholder-0001"
  admin_username                  = "fxadmin"
  size                            = "Standard_B1s"
  os_disk {
    storage_account_type = "Standard_LRS"
    caching              = "None"
  }
  network_interface_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/networkInterfaces/fx-linux-network-interface-ids"]
  location              = "westeurope"
  name                  = "linux"
  resource_group_name   = azurerm_resource_group.compute.name
}
resource "azurerm_windows_virtual_machine" "windows" {
  source_image_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-image"
  admin_password  = "Fx-Placeholder-0001"
  admin_username  = "fxadmin"
  size            = "Standard_B1s"
  os_disk {
    storage_account_type = "Standard_LRS"
    caching              = "None"
  }
  network_interface_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/networkInterfaces/fx-windows-network-interface-ids"]
  location              = "westeurope"
  name                  = "windows"
  resource_group_name   = azurerm_resource_group.compute.name
}
resource "azurerm_virtual_machine" "legacy" {
  vm_size = "fx-legacy-vm-size"
  storage_os_disk {
    name          = "fx-legacy-name"
    create_option = "fx-legacy-create-option"
  }
  network_interface_ids = ["fixture"]
  location              = "westeurope"
  name                  = "legacy"
  resource_group_name   = azurerm_resource_group.compute.name
}
resource "azurerm_linux_virtual_machine_scale_set" "linux" {
  source_image_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-linux-source-image-id"
  sku             = "fx-linux-sku"
  os_disk {
    storage_account_type = "Premium_LRS"
    caching              = "None"
  }
  network_interface {
    name = "fx-linux-name"
    ip_configuration {
      name = "fx-linux-name"
    }
  }
  location            = "westeurope"
  admin_username      = "fx-linux-admin-username"
  name                = "linux"
  resource_group_name = azurerm_resource_group.compute.name
}
resource "azurerm_windows_virtual_machine_scale_set" "windows" {
  source_image_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-windows-source-image-id"
  sku             = "fx-windows-sku"
  os_disk {
    storage_account_type = "Premium_LRS"
    caching              = "None"
  }
  network_interface {
    name = "fx-windows-name"
    ip_configuration {
      name = "fx-windows-name"
    }
  }
  location            = "westeurope"
  instances           = 1
  admin_username      = "fx-windows-admin-username"
  admin_password      = "fx-windows-admin-password"
  name                = "windows"
  resource_group_name = azurerm_resource_group.compute.name
}
resource "azurerm_virtual_machine_scale_set" "legacy" {
  upgrade_policy_mode = "Automatic"
  storage_profile_os_disk {
    create_option = "fx-legacy-create-option"
  }
  sku {
    name     = "fx-legacy-name"
    capacity = 1
  }
  os_profile {
    computer_name_prefix = "fx-legacy-computer-name-prefix"
    admin_username       = "fx-legacy-admin-username"
  }
  network_profile {
    primary = false
    name    = "fx-legacy-name"
    ip_configuration {
      subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/virtualNetworks/fx-vnet/subnets/fx-legacy-subnet-id"
      primary   = false
      name      = "fx-legacy-name"
    }
  }
  location            = "westeurope"
  name                = "legacy"
  resource_group_name = azurerm_resource_group.compute.name
}
resource "azurerm_linux_virtual_machine" "literal" {
  source_image_id                 = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-image"
  disable_password_authentication = false
  admin_password                  = "Fx-Placeholder-0001"
  admin_username                  = "fxadmin"
  size                            = "Standard_B1s"
  os_disk {
    storage_account_type = "Standard_LRS"
    caching              = "None"
  }
  network_interface_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/networkInterfaces/fx-literal-network-interface-ids"]
  location              = "westeurope"
  name                  = "literal"
  resource_group_name   = "compute"
}
resource "azurerm_linux_virtual_machine" "unknown" {
  source_image_id                 = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Compute/images/fx-image"
  disable_password_authentication = false
  admin_password                  = "Fx-Placeholder-0001"
  admin_username                  = "fxadmin"
  size                            = "Standard_B1s"
  os_disk {
    storage_account_type = "Standard_LRS"
    caching              = "None"
  }
  network_interface_ids = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/fx-rg/providers/Microsoft.Network/networkInterfaces/fx-unknown-network-interface-ids"]
  location              = "westeurope"
  name                  = "unknown"
  resource_group_name   = terraform_data.unknown_group.id
}
