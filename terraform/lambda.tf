# Define the lambda function used to process input

# Lambda function definition
resource "aws_lambda_function" "MoodleAccessibilityLambda" {

  function_name = local.lambda_function_name

  # The S3 bucket containing the lambda code.  If present, add an optional suffic
  s3_bucket = local.s3_deploy_bucket
  s3_key    = var.deploy_s3_key

  handler = "index.handler"
  runtime = "nodejs12.x"

  role = aws_iam_role.iam_for_lambda.arn

  environment {
    variables = {
      bucketName    = local.s3_upload_bucket
      maxFileSizeMB = var.maxFileSizeUpload
    }
  }

  timeout = var.lambdaTimeout

  depends_on = [aws_iam_role_policy_attachment.lambda_policy]
}


# IAM role which dictates what other AWS services the Lambda function
# may access.
resource "aws_iam_role" "iam_for_lambda" {
  name        = local.iam_role_name
  description = "Moodle Accessibility Lambda function IAM role"

  assume_role_policy = <<EOF
{
   "Version": "2012-10-17",
   "Statement": [
     {
       "Action": "sts:AssumeRole",
       "Principal": {
         "Service": "lambda.amazonaws.com"
       },
       "Effect": "Allow",
       "Sid": ""
     }
   ]
}
EOF

}

# Allow the API Gateway to invoke the Lambda function
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.MoodleAccessibilityLambda.function_name
  principal     = "apigateway.amazonaws.com"

  # The "/*/*" portion grants access from any method on any resource
  # within the API Gateway REST API.
  source_arn = "${aws_api_gateway_rest_api.MoodleAccessibilityAPI.execution_arn}/*/*"
}


# Define the permissions the Lambda function requires:
#   - Write to Cloudwatch logs
#   - Full control to read/write/delete from S3 bucket for file uploads
data "aws_iam_policy_document" "lambda_permissions" {

  # Write to Cloudwatch logs
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }

  # Full permissions for file upload S3 bucket
  statement {
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${local.s3_upload_bucket}",
      "arn:aws:s3:::${local.s3_upload_bucket}/*"
    ]
  }

}

# Convert Terraform policy document to JSON for AWS IAM policy
resource "aws_iam_policy" "lambda_policy" {
  name        = local.iam_policy_name
  path        = "/"
  description = "IAM policy for Moodle accessibility lambda function"
  policy      = data.aws_iam_policy_document.lambda_permissions.json
}

# Attach IAM policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.iam_for_lambda.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}