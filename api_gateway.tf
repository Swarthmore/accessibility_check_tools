# Define API Gateway and proxy for Lambda function

# To force update, run: 
# terraform taint aws_api_gateway_deployment.MoodleAccessibilityGateway
# terraform apply


# Define API Gateway
resource "aws_api_gateway_rest_api" "MoodleAccessibilityAPI" {
  name        = local.api_name
  description = "Moodle Accessibility API"
}


# Define the "requesturl" path and integration with Lambda
resource "aws_api_gateway_resource" "requesturl" {
  rest_api_id = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  parent_id   = aws_api_gateway_rest_api.MoodleAccessibilityAPI.root_resource_id
  path_part   = "requesturl"
}

resource "aws_api_gateway_method" "requesturl" {
  rest_api_id   = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  resource_id   = aws_api_gateway_resource.requesturl.id
  http_method   = "GET"                     # Use GET for client
  authorization = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "lambda_requesturl" {
  rest_api_id             = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  resource_id             = aws_api_gateway_method.requesturl.resource_id
  http_method             = aws_api_gateway_method.requesturl.http_method
  integration_http_method = "POST"          # Lambda trigger must be POST
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.MoodleAccessibilityLambda.invoke_arn
}


# Define the "scan" path and integration with Lambda
resource "aws_api_gateway_resource" "scan" {
  rest_api_id = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  parent_id   = aws_api_gateway_rest_api.MoodleAccessibilityAPI.root_resource_id
  path_part   = "scan"
}

resource "aws_api_gateway_method" "scan" {
  rest_api_id   = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  resource_id   = aws_api_gateway_resource.scan.id
  http_method   = "POST"
  authorization = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "lambda_scan" {
  rest_api_id             = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  resource_id             = aws_api_gateway_method.scan.resource_id
  http_method             = aws_api_gateway_method.scan.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.MoodleAccessibilityLambda.invoke_arn
}


# Define a usage plan to prevent over-use
resource "aws_api_gateway_usage_plan" "defaultUseagePlan" {
  name = local.usage_plan_name

  api_stages {
    api_id = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
    stage  = aws_api_gateway_deployment.MoodleAccessibilityGateway.stage_name
  }

  quota_settings {
    limit  = 10000
    period = "DAY"
  }

  throttle_settings {
    burst_limit = 20
    rate_limit  = 10
  }

}

# Create an API key to use with the default usage plan
resource "aws_api_gateway_api_key" "default_apikey" {
  name = local.api_key_name
}

# Associate the default API key with the default usage plan
resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.default_apikey.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.defaultUseagePlan.id
}


# Define API Gateway stage
resource "aws_api_gateway_deployment" "MoodleAccessibilityGateway" {
  depends_on = [
    aws_api_gateway_integration.lambda_requesturl,
    aws_api_gateway_integration.lambda_scan
  ]

  rest_api_id = aws_api_gateway_rest_api.MoodleAccessibilityAPI.id
  stage_name  = var.api_stage
}

# Print out the url when done deploying
output "base_url" {
  value = aws_api_gateway_deployment.MoodleAccessibilityGateway.invoke_url
}

# Print out the default API key when done deploying
output "api_key" {
  value = aws_api_gateway_api_key.default_apikey.value
}