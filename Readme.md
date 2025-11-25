# Feature Toggle Lambda Function

A serverless AWS Lambda function for managing feature flags with S3 as the storage backend. This service provides a complete feature flag management system with platform segmentation, user authentication, and comprehensive logging.

## Features

- 🚀 **Platform Management**: Create and manage multiple platforms (Web, Mobile, etc.)
- 🎯 **Feature Segmentation**: Target features to specific user segments
- 📊 **Rollout Control**: Gradual feature rollouts with percentage-based distribution
- 🔐 **JWT Authentication**: Secure API access with JSON Web Tokens
- 📝 **Audit Logging**: Complete audit trail of all feature changes
- 🏗️ **Modular Architecture**: Clean, organized, and maintainable codebase

## Project Structure

```
src/
├── config/          # Configuration files
│   ├── constants.mjs # Application constants
│   └── aws.mjs      # AWS client configuration
├── handlers/        # Business logic handlers
│   ├── platformHandlers.mjs
│   ├── segmentHandlers.mjs
│   ├── groupHandlers.mjs
│   └── featureHandlers.mjs
├── utils/           # Utility functions
│   ├── s3.mjs       # S3 operations
│   ├── auth.mjs     # JWT authentication
│   └── helpers.mjs  # Helper functions
├── validation/      # Data validation
│   ├── schemas.mjs  # JSON schemas
│   └── validators.mjs # Validation functions
├── logging/         # Logging functionality
│   └── logger.mjs   # Audit logging
└── index.mjs        # Main Lambda handler
```

## Setup

### Prerequisites
- AWS Account with appropriate permissions
- Node.js 18.x or later
- AWS CLI configured

### AWS Resources Setup

1. **Create S3 Bucket**
   ```bash
   aws s3 mb s3://your-feature-toggle-bucket
   ```

2. **Create IAM Role for Lambda**
   - Create a role with the following policies:
     - `AWSLambdaBasicExecutionRole`
     - Custom policy for S3 access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-feature-toggle-bucket",
           "arn:aws:s3:::your-feature-toggle-bucket/*"
         ]
       }
     ]
   }
   ```

3. **Create Lambda Function**
   ```bash
   aws lambda create-function \
     --function-name feature-toggle-lambda \
     --runtime nodejs18.x \
     --handler src/index.handler \
     --zip-file fileb://deployment.zip \
     --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-s3-role
   ```

4. **Configure API Gateway** (Optional)
   - Create a REST API
   - Create a resource and method
   - Enable CORS
   - Deploy the API

### Environment Configuration

Update `src/config/constants.mjs` with your configuration:
```javascript
export const BUCKET = "your-feature-toggle-bucket";
export const JWT_SECRET = "your-jwt-secret";
```

## API Usage

All requests require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Platform Management

**Add Platform**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "add-platform",
    "newPlatforms": ["WEB", "MOBILE"]
  }'
```

### Segment Management

**Create Segment**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "create-segment",
    "segmentName": "country",
    "segmentDescription": "User Country",
    "segmentValues": ["US", "UK", "CA"]
  }'
```

**Update Segment**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "update-segment",
    "segmentName": "country",
    "segmentDescription": "Updated Country Description"
  }'
```

### Group Management

**Create Group**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "create-group",
    "platform": "WEB",
    "featureGroup": {
      "id": "ui-features",
      "description": "UI Feature Toggles"
    }
  }'
```

### Feature Management

**Create Feature**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "create-feature",
    "platform": "WEB",
    "feature": {
      "id": "new-checkout",
      "groupId": "ui-features",
      "description": "New Checkout Flow",
      "type": "boolean",
      "value": false,
      "rollout": {
        "percentage": 50,
        "secondaryValue": true
      }
    }
  }'
```

**Change Feature Value**
```bash
curl -X POST '<LAMBDA_ENDPOINT>' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-jwt-token>' \
  -d '{
    "action": "change-feature-value",
    "platform": "WEB",
    "feature": {"id": "new-checkout"},
    "segmentCombination": {"country": ["US"]},
    "featureValue": true,
    "rollout": {
      "percentage": 25,
      "secondaryValue": false
    }
  }'
```

## Development

### Local Development
```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 🚀 Quick Start Deployment

### 1. Configure AWS
```bash
# Install AWS CLI (if not installed)
brew install awscli

# Configure your AWS credentials
aws configure
```

### 2. One-Time Setup
```bash
# Run the automated setup script
npm run setup:aws
# OR
./setup-aws.sh
```

This will create:
- S3 bucket for data storage
- IAM role and policies
- Lambda function
- API Gateway (optional)

### 3. Deploy Updates
```bash
# For future code updates
npm run deploy your-lambda-function-name
# OR
./deploy.sh your-lambda-function-name
```

### 4. Test Your Deployment
```bash
# Test all endpoints
npm run test:lambda
# OR
./test-lambda.sh
```

### Manual Deployment (Alternative)
```bash
# Install dependencies
npm install --production

# Create deployment package
npm run package

# Update Lambda function
aws lambda update-function-code \
  --function-name feature-toggle-lambda \
  --zip-file fileb://deployment.zip
```

## Related Projects

- [Management Interface](https://github.com/aabbdduurr/featuresPOC-Management) - Web UI for managing feature flags
- [Client Interface](https://github.com/aabbdduurr/featuresPOC-Client) - Demo client for testing feature flags

## Architecture

The service uses S3 for data persistence with the following structure:
- `platforms.json` - List of available platforms
- `segments.json` - Segment definitions and values  
- `platforms/{platform}.json` - Platform-specific feature configurations
- `logs/{platform}/{group}/{feature}.json` - Audit logs for changes

## License

Use it as you like. No restrictions.
