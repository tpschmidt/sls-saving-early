terraform {
  required_version = "=0.14.4"
  required_providers {
    aws = "~> 3.24.1"
  }

  backend s3 {
    bucket         = "tpschmidt-terraform-state"
    key            = "saving-early/prod.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-state-lock"
  }
}

provider aws {
  region = local.region
  allowed_account_ids = [local.account_id]
}

provider aws {
  region = "eu-central-1"
  alias  = "eu-central-1"
}

provider aws {
  region = "us-east-1"
  alias  = "us-east-1"
}

module cloudfront {
  source       = "../../modules/cloudfront"
  domain       = local.domain_name
  app_name     = local.app_name
  account_name = local.account_name
  providers = {
    aws.us-east-1 = aws.us-east-1
  }
}
