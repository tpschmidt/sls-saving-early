data "aws_caller_identity" "current" {}

locals {
  region               = "eu-central-1"
  account_name         = "prod"
  domain_name          = jsondecode(file("../../../config.json")).domain_name
  account_id           = jsondecode(file("../../../config.json")).aws_account_id
  app_name             = jsondecode(file("../../../config.json")).app_name

  lambdas_node_runtime = "nodejs12.x"
}
