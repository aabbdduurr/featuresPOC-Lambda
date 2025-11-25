# 🚀 AWS Deployment Quick Start Guide

## Step 1: Configure AWS CLI

You need AWS credentials to deploy your Lambda function. Here are your options:

### Option A: Use AWS SSO (Recommended for Organizations)
```bash
aws configure sso
```

### Option B: Use Access Keys (Individual/Personal)
```bash
aws configure
```
You'll need:
- AWS Access Key ID
- AWS Secret Access Key  
- Default region (e.g., `us-east-1`)
- Default output format (`json`)

### Option C: Use Temporary Credentials
```bash
aws login  # If your organization uses this
```

## Step 2: Get AWS Credentials

### If you don't have AWS credentials yet:

1. **Sign up for AWS** (if you don't have an account):
   - Go to https://aws.amazon.com/
   - Click "Create an AWS Account"
   - Follow the signup process (requires credit card)

2. **Create Access Keys**:
   - Go to AWS Console → IAM → Users
   - Create a new user or use existing
   - Attach policy: `PowerUserAccess` (for deployment)
   - Go to Security Credentials tab
   - Create Access Key → Choose "CLI" use case
   - Copy the Access Key ID and Secret Access Key

## Step 3: Run the Setup

Once AWS CLI is configured, run the complete setup:

```bash
# Configure AWS (one-time setup)
aws configure

# Run the automated setup script
./setup-aws.sh
```

## Step 4: Deploy Updates

For future code updates, use the deploy script:

```bash
./deploy.sh your-lambda-function-name
```

## 🔍 Troubleshooting

### "Unable to locate credentials"
- Run `aws configure` and enter your credentials
- Verify with: `aws sts get-caller-identity`

### "Access Denied" errors
- Make sure your user has the necessary permissions:
  - IAM permissions for creating roles/policies
  - Lambda permissions for creating/updating functions
  - S3 permissions for creating/managing buckets

### Bucket already exists
- The script generates unique bucket names
- If it fails, wait a few minutes and try again

## 📊 What the Setup Script Creates

1. **S3 Bucket** - Stores your feature flag data
2. **IAM Role** - Allows Lambda to access S3
3. **IAM Policy** - Defines S3 permissions
4. **Lambda Function** - Your feature toggle service
5. **API Gateway** (optional) - HTTP endpoint for your Lambda

## 💡 Tips

- **Free Tier**: AWS offers free tier for Lambda (1M requests/month)
- **Security**: Use least-privilege IAM policies in production
- **Monitoring**: Check CloudWatch logs for debugging
- **Cost**: Monitor S3 storage and Lambda execution costs

## 🎯 Next Steps After Deployment

1. Test your function in AWS Console
2. Update JWT_SECRET in your code
3. Set up monitoring and alerts
4. Configure custom domain (optional)
5. Set up CI/CD pipeline (optional)