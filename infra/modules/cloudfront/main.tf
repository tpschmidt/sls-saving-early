data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

provider "aws" {
  alias = "us-east-1"
}
