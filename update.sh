if [[ ! -f terraform.tfvars ]] ; then
    echo 'File "terraform.tfvars" not found, aborting.'
    exit
fi

# Get deployment S3 bucket and AWS Region from Terraform variable file
aws_region=$(sed -n 's/aws_region = "\(.*\)"/\1/p' terraform.tfvars)

# Add deploy suffix to S3 bucket (if present)
s3_deploy_bucket=$(sed -n 's/deploy_s3_bucket = "\(.*\)"/\1/p' terraform.tfvars)
deploy_suffix=$(sed -n 's/deploysuffix = "\(.*\)"/\1/p' terraform.tfvars)
if [ $deploy_suffix ]
then
    s3_deploy_bucket="${s3_deploy_bucket}-${deploy_suffix}" 
fi

# Add deploy suffix tp function name (if present)
lambda_function_name=MoodleAccessibility
if [ $deploy_suffix ]
then
    lambda_function_name="${lambda_function_name}-${deploy_suffix}" 
fi


# Zip up AWS Lambda code with node script and modules
cd lambda_function
npm install
zip -r ../moodle-accessibility-lambda.zip *
cd ..

# Put zip file in  deployment S3 bucket
aws s3api put-object --bucket $s3_deploy_bucket --key moodle-accessibility-lambda --region $aws_region --body moodle-accessibility-lambda.zip;

# Tell AWS Lambda to update with code from the deploy S3 bucket
aws lambda  update-function-code --function-name ${lambda_function_name} --s3-bucket $s3_deploy_bucket --s3-key moodle-accessibility-lambda
