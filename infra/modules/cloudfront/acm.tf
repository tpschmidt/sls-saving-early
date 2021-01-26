data "aws_acm_certificate" "main" {
  domain   = replace(data.aws_route53_zone.main.name, "/[.]$/", "")
  provider = aws.us-east-1
}

