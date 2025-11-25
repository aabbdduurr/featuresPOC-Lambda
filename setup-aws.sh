#!/bin/bash

# Feature Toggle Lambda - AWS Setup Script
# This script helps you set up all the AWS resources needed for the feature toggle service

set -e

echo "Setting up AWS resources for Feature Toggle Lambda..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration from config.env file
if [[ -f "config.env" ]]; then
    echo "Loading configuration from config.env..."
    source config.env
    REGION="$AWS_REGION"
else
    echo "config.env not found, using default configuration..."
    # Default configuration
    BUCKET_NAME="feature-toggle-bucket-abdur-1764071798"
    LAMBDA_FUNCTION_NAME="feature-toggle-lambda"
    LAMBDA_ROLE_NAME="feature-toggle-lambda-role"
    LAMBDA_POLICY_NAME="feature-toggle-s3-policy"
    REGION="ap-south-1"
    CREATE_API_GATEWAY="true"
fi

echo -e "${BLUE}Configuration:${NC}"
echo "  Bucket Name: $BUCKET_NAME"
echo "  Function Name: $LAMBDA_FUNCTION_NAME"
echo "  Role Name: $LAMBDA_ROLE_NAME"
echo "  Region: $REGION"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}AWS CLI not configured. Please run:${NC}"
    echo "   aws configure"
    echo "   Enter your AWS Access Key ID, Secret Access Key, region, and output format"
    exit 1
fi

echo -e "${GREEN}AWS CLI is configured${NC}"

# Step 1: Create S3 Bucket or use existing one
echo -e "${BLUE}Creating S3 bucket: $BUCKET_NAME${NC}"
if aws s3 mb "s3://$BUCKET_NAME" --region "$REGION" 2>/dev/null; then
    echo -e "${GREEN}S3 bucket created successfully${NC}"
else
    # Check if bucket already exists and we can access it
    if aws s3 ls "s3://$BUCKET_NAME" >/dev/null 2>&1; then
        echo -e "${YELLOW}S3 bucket already exists, using existing bucket${NC}"
    else
        # Try to find existing feature-toggle bucket
        EXISTING_BUCKET=$(aws s3 ls | grep feature-toggle-bucket | tail -n 1 | awk '{print $3}')
        if [[ -n "$EXISTING_BUCKET" ]]; then
            BUCKET_NAME="$EXISTING_BUCKET"
            echo -e "${YELLOW}Using existing bucket: $BUCKET_NAME${NC}"
        else
            echo -e "${RED}Failed to create or find S3 bucket${NC}"
            exit 1
        fi
    fi
fi

# Step 2: Enable versioning on the bucket
echo -e "${BLUE}Enabling versioning on S3 bucket${NC}"
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled

# Step 2.1: Configure bucket for public read access
echo -e "${BLUE}Configuring S3 bucket for public read access${NC}"

# Remove public access block
aws s3api delete-public-access-block --bucket "$BUCKET_NAME" 2>/dev/null || true

# Create bucket policy for public read access
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

# Apply bucket policy
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file://bucket-policy.json
echo -e "${GREEN}Public read access configured${NC}"

# Step 2.2: Configure CORS for localhost and development
echo -e "${BLUE}Configuring CORS for S3 bucket${NC}"
cat > cors-configuration.json << EOF
{
    "CORSRules": [
        {
            "AllowedOrigins": [
                "http://localhost:*",
                "https://localhost:*",
                "http://127.0.0.1:*",
                "https://127.0.0.1:*"
            ],
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

# Apply CORS configuration
aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration file://cors-configuration.json
echo -e "${GREEN}CORS configuration applied${NC}"

# Step 3: Create IAM policy for Lambda
echo -e "${BLUE}Creating IAM policy for Lambda${NC}"
cat > lambda-s3-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::$BUCKET_NAME",
                "arn:aws:s3:::$BUCKET_NAME/*"
            ]
        }
    ]
}
EOF

# Check if policy exists and delete if it does
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${LAMBDA_POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    echo -e "${YELLOW}Policy exists, updating...${NC}"
    # Get policy versions and delete non-default ones first
    aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?!IsDefaultVersion].[VersionId]' --output text | while read version; do
        [ -n "$version" ] && aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$version" >/dev/null 2>&1
    done
    # Create new version and set as default
    aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document file://lambda-s3-policy.json --set-as-default >/dev/null
    echo -e "${GREEN}IAM policy updated${NC}"
else
    aws iam create-policy \
        --policy-name "$LAMBDA_POLICY_NAME" \
        --policy-document file://lambda-s3-policy.json >/dev/null
    echo -e "${GREEN}IAM policy created${NC}"
fi

# Step 4: Create IAM role for Lambda
echo -e "${BLUE}Creating IAM role for Lambda${NC}"
cat > trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

if aws iam create-role \
    --role-name "$LAMBDA_ROLE_NAME" \
    --assume-role-policy-document file://trust-policy.json >/dev/null; then
    echo -e "${GREEN}IAM role created${NC}"
else
    echo -e "${YELLOW}Role might already exist${NC}"
fi

# Step 5: Attach policies to role
echo -e "${BLUE}Attaching policies to role${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach basic execution role
aws iam attach-role-policy \
    --role-name "$LAMBDA_ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"

# Attach custom S3 policy
aws iam attach-role-policy \
    --role-name "$LAMBDA_ROLE_NAME" \
    --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$LAMBDA_POLICY_NAME"

echo -e "${GREEN}Policies attached to role${NC}"

# Step 6: Update constants file with bucket name
echo -e "${BLUE}Updating configuration with bucket name${NC}"
if [[ -f "src/config/constants.mjs" ]]; then
    # Update bucket name regardless of current value
    sed -i.bak "s/export const BUCKET = \".*\";/export const BUCKET = \"$BUCKET_NAME\";/" src/config/constants.mjs
    echo -e "${GREEN}Configuration updated with bucket: $BUCKET_NAME${NC}"
else
    echo -e "${RED}Configuration file not found${NC}"
    exit 1
fi

# Step 7: Build the project
echo -e "${BLUE}Building project${NC}"
# First install all dependencies (including dev) for linting
npm install

# Run linting if eslint is available
if npm run lint --silent >/dev/null 2>&1; then
    echo -e "${GREEN}Code linting passed${NC}"
else
    echo -e "${YELLOW}Linting skipped (not blocking deployment)${NC}"
fi

# Then install production dependencies for deployment
echo -e "${BLUE}Installing production dependencies${NC}"
npm install --production

# Step 8: Create CloudWatch log group
echo -e "${BLUE}Creating CloudWatch log group${NC}"
aws logs create-log-group \
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION_NAME" \
    --region "$REGION" 2>/dev/null || echo -e "${YELLOW}Log group already exists${NC}"

# Set log retention policy (optional)
aws logs put-retention-policy \
    --log-group-name "/aws/lambda/$LAMBDA_FUNCTION_NAME" \
    --retention-in-days 14 \
    --region "$REGION" 2>/dev/null || true

echo -e "${GREEN}CloudWatch log group ready${NC}"

# Step 9: Create deployment package
echo -e "${BLUE}Creating deployment package${NC}"
zip -r deployment.zip src/ package.json node_modules/ -x "*.DS_Store" "node_modules/.cache/*"

# Step 10: Create or update Lambda function
echo -e "${BLUE}Creating/updating Lambda function${NC}"
sleep 10  # Wait for role to be fully created

# Check if function already exists
if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo -e "${YELLOW}Lambda function exists, updating code${NC}"
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file fileb://deployment.zip \
        --region "$REGION"
    
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --timeout 30 \
        --memory-size 512 \
        --environment "Variables={NODE_ENV=production,CUSTOM_AWS_REGION=$REGION,BUCKET_NAME=$BUCKET_NAME,JWT_SECRET=$JWT_SECRET}" \
        --region "$REGION"
    echo -e "${GREEN}Lambda function updated successfully${NC}"
else
    if aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime nodejs18.x \
        --handler src/index.handler \
        --zip-file fileb://deployment.zip \
        --role "arn:aws:iam::$AWS_ACCOUNT_ID:role/$LAMBDA_ROLE_NAME" \
        --timeout 30 \
        --memory-size 512 \
        --environment "Variables={NODE_ENV=production,CUSTOM_AWS_REGION=$REGION,BUCKET_NAME=$BUCKET_NAME,JWT_SECRET=$JWT_SECRET}" \
        --region "$REGION"; then
        echo -e "${GREEN}Lambda function created successfully${NC}"
    else
        echo -e "${RED}Failed to create Lambda function${NC}"
        exit 1
    fi
fi

# Step 11: Create API Gateway (automated)
if [[ $CREATE_API_GATEWAY == "true" ]]; then
    echo -e "${BLUE}Creating/updating API Gateway${NC}"
    
    # Check if API already exists
    EXISTING_API_ID=$(aws apigateway get-rest-apis --query "items[?name=='feature-toggle-api'].id" --output text 2>/dev/null || true)
    
    if [[ -n "$EXISTING_API_ID" && "$EXISTING_API_ID" != "None" ]]; then
        echo -e "${YELLOW}API Gateway already exists, using existing API: $EXISTING_API_ID${NC}"
        API_ID="$EXISTING_API_ID"
        
        # Update existing API with CORS configuration
        echo -e "${BLUE}Configuring CORS for existing API Gateway${NC}"
        ROOT_ID=$(aws apigateway get-resources \
            --rest-api-id "$API_ID" \
            --query 'items[0].id' --output text)
        
        # Add/update OPTIONS method for CORS preflight
        aws apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --authorization-type NONE 2>/dev/null || true
        
        # Create OPTIONS integration for CORS preflight
        aws apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --type MOCK \
            --request-templates '{"application/json":"{\"statusCode\":200}"}' 2>/dev/null || true
        
        # Create method responses for CORS
        aws apigateway put-method-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' 2>/dev/null || true
        
        aws apigateway put-method-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' 2>/dev/null || true
        
        # Create integration responses for CORS
        aws apigateway put-integration-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'"}' 2>/dev/null || true
        
        aws apigateway put-integration-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'"}' 2>/dev/null || true
        
        echo -e "${GREEN}CORS configuration added to existing API Gateway${NC}"
    else
        # Create new API
        API_ID=$(aws apigateway create-rest-api \
            --name "feature-toggle-api" \
            --description "API for Feature Toggle Lambda" \
            --query 'id' --output text)
        echo -e "${GREEN}API Gateway created: $API_ID${NC}"
        
        # Get root resource ID
        ROOT_ID=$(aws apigateway get-resources \
            --rest-api-id "$API_ID" \
            --query 'items[0].id' --output text)
        
        # Create POST method
        aws apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --authorization-type NONE 2>/dev/null || true
        
        # Create OPTIONS method for CORS preflight
        aws apigateway put-method \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --authorization-type NONE 2>/dev/null || true
        
        # Create POST integration
        aws apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --type AWS_PROXY \
            --integration-http-method POST \
            --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$AWS_ACCOUNT_ID:function:$LAMBDA_FUNCTION_NAME/invocations" 2>/dev/null || true
        
        # Create OPTIONS integration for CORS preflight
        aws apigateway put-integration \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --type MOCK \
            --request-templates '{"application/json":"{\"statusCode\":200}"}' 2>/dev/null || true
        
        # Create method response for POST
        aws apigateway put-method-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' 2>/dev/null || true
        
        # Create method response for OPTIONS
        aws apigateway put-method-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' 2>/dev/null || true
        
        # Create integration response for POST
        aws apigateway put-integration-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method POST \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'"}' 2>/dev/null || true
        
        # Create integration response for OPTIONS
        aws apigateway put-integration-response \
            --rest-api-id "$API_ID" \
            --resource-id "$ROOT_ID" \
            --http-method OPTIONS \
            --status-code 200 \
            --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'OPTIONS,POST'"'"'"}' 2>/dev/null || true
    fi
    
    # Always try to add/update Lambda permission for API Gateway (ignore if exists)
    aws lambda add-permission \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --statement-id "api-gateway-invoke" \
        --action "lambda:InvokeFunction" \
        --principal "apigateway.amazonaws.com" \
        --source-arn "arn:aws:execute-api:$REGION:$AWS_ACCOUNT_ID:$API_ID/*/*" 2>/dev/null || \
    aws lambda remove-permission \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --statement-id "api-gateway-invoke" 2>/dev/null && \
    aws lambda add-permission \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --statement-id "api-gateway-invoke" \
        --action "lambda:InvokeFunction" \
        --principal "apigateway.amazonaws.com" \
        --source-arn "arn:aws:execute-api:$REGION:$AWS_ACCOUNT_ID:$API_ID/*/*" 2>/dev/null || true
    
    # Deploy API
    aws apigateway create-deployment \
        --rest-api-id "$API_ID" \
        --stage-name "prod" >/dev/null 2>&1 || true
    
    API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
    echo -e "${GREEN}API Gateway ready: $API_URL${NC}"
    
    # Update config.env file with the API endpoint
    if [[ -f "config.env" ]]; then
        echo "Updating config.env with API endpoint..."
        # Remove existing API_ENDPOINT line and add new one
        grep -v "^API_ENDPOINT=" config.env > config.env.tmp && mv config.env.tmp config.env
        echo "API_ENDPOINT=$API_URL" >> config.env
        echo -e "${GREEN}API endpoint saved to config.env${NC}"
    fi
else
    echo -e "${YELLOW}Skipping API Gateway creation${NC}"
fi

# Cleanup temporary files
echo -e "${BLUE}Cleaning up temporary files${NC}"
rm -f lambda-s3-policy.json trust-policy.json bucket-policy.json cors-configuration.json deployment.zip

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  Lambda Function: $LAMBDA_FUNCTION_NAME"
echo "  Region: $REGION"
if [[ -n $API_URL ]]; then
    echo "  API Endpoint: $API_URL"
fi
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Test your Lambda function in the AWS console"
echo "  2. Update your JWT_SECRET in src/config/constants.mjs"
echo "  3. Use the deploy.sh script for future updates"
echo ""
echo -e "${YELLOW}To update your function later:${NC}"
echo "   ./deploy.sh $LAMBDA_FUNCTION_NAME"