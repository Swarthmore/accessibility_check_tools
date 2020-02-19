if [[ ! -f terraform.tfvars ]] ; then
    echo 'File "terraform.tfvars" not found, aborting.'
    exit
fi

# Get AWS Profile from Terraform variable file
aws_profile=$(sed -n 's/aws_profile = "\(.*\)"/\1/p' terraform.tfvars)
if [ -z "$aws_profile" ]
then
      echo "AWS profile not configured in terraform.tfvars"
      exit 1
fi

# Get deployment S3 bucket and AWS Region from Terraform variable file
aws_region=$(sed -n 's/aws_region = "\(.*\)"/\1/p' terraform.tfvars)
if [ -z "$aws_region" ]
then
      echo "AWS region not configured in terraform.tfvars"
      exit 1
fi

echo "Using AWS profile \"$aws_profile\" in the \"$aws_region\" region"

# Add deploy suffix to S3 bucket (if present)
s3_deploy_bucket=$(sed -n 's/deploy_s3_bucket = "\(.*\)"/\1/p' terraform.tfvars)
s3_deploy_key=$(sed -n 's/deploy_s3_key = "\(.*\)"/\1/p' terraform.tfvars)
deploy_suffix=$(sed -n 's/deploysuffix = "\(.*\)"/\1/p' terraform.tfvars)
if [ $deploy_suffix ]
then
    s3_deploy_bucket="${s3_deploy_bucket}-${deploy_suffix}" 
fi

# Create deployment S3 bucket
echo "Creating S3 bucket: \"$s3_deploy_bucket\""
aws s3 mb s3://$s3_deploy_bucket --profile $aws_profile
if [ $? -ne 0 ]
then
echo "Error creating S3 deploy bucket"
exit 1
fi


# Zip up AWS Lambda code with node script and modules
echo "Building lambda filescan package"
cd lambda_function
npm install
zip -r ../moodle-accessibility-lambda.zip *
cd ..

# Build node modules for testing
echo "Building test scripts"
cd test/js
npm install
cd ../..

# Put zip file in  deployment S3 bucket
echo "Sending Lambda function package to S3 deploy bucket with key \"$s3_deploy_key\""
aws s3api put-object --bucket $s3_deploy_bucket --key $s3_deploy_key --region $aws_region --body moodle-accessibility-lambda.zip --profile $aws_profile
if [ $? -ne 0 ]
then
echo "Error uploading Lambda filescan package to S3 deploy bucket"
exit 1
fi

# Set up Terraform
echo "Setting up Teraform"
terraform init
terraform apply 
