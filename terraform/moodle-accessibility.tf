# Basic configuration for Terraform deployment

# Variables are set up in "terraform.tfvars".  See "terraform.tfvars.dist" for example settings.  


# Configure variables
variable "aws_profile" {
  type = string
}
variable "aws_region" {
  type = string
}
variable "deploysuffix" {
  type = string
}
variable "api_stage" {
  type = string
}
variable "UploadBucket" {
  type = string
}
variable "deploy_s3_bucket" {
  type = string
}
variable "deploy_s3_key" {
  type = string
}
variable "maxFileSizeUpload" {
  type = number
}
variable "lambdaTimeout" {
  type = number
}

# Calculate extra values with a deploy suffix (if present)
locals {
  lambda_function_name = "MoodleAccessibility%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  s3_deploy_bucket     = "${var.deploy_s3_bucket}%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  s3_upload_bucket     = "${var.UploadBucket}%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  api_name             = "MoodleAccessibilityAPI%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  usage_plan_name      = "DefaultUseagePlan%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  api_key_name         = "DefaultAPIKey%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  iam_role_name        = "Moodle_Accessibility_IAM_Role%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
  iam_policy_name      = "Moodle_Accessibility_IAM_Policy%{if var.deploysuffix != ""}-${var.deploysuffix}%{endif}"
}


# Set up AWS
provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}

# Set up file upload bucket
resource "aws_s3_bucket" "FileUploadBucket" {
  bucket = local.s3_upload_bucket
  acl    = "private"

  tags = {
    Name        = "Moodle Accessibilty File Upload Bucket"
    Environment = "test"
  }

  # Delete uploaded files every day
  lifecycle_rule {
    id      = "purge"
    enabled = true

    expiration {
      days = 1
    }
  }

}

