# Feature Toggle Lambda Function

A serverless AWS Lambda function for managing feature flags with S3 as the storage backend. This service provides a complete feature flag management system with platform segmentation, user authentication, and comprehensive logging.

## Features

- **Platform Management**: Create and manage multiple platforms (Web, Mobile, etc.)
- **Feature Segmentation**: Target features to specific user segments
- **Rollout Control**: Gradual feature rollouts with percentage-based distribution
- **JWT Authentication**: Secure API access with JSON Web Tokens
- **Audit Logging**: Complete audit trail of all feature changes
- **Modular Architecture**: Clean, organized, and maintainable codebase

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

### Centralized Configuration

**`config.env` is your single source of truth** for all configuration:
- Shell scripts read from this file
- Lambda function gets these as environment variables  
- Application code reads from `process.env`

**Setup:**
```bash
# 1. Edit config.env with your settings (optional)
nano config.env

# Example customizations:
AWS_REGION=us-east-1  # Change to your preferred region
BUCKET_NAME=your-unique-bucket-name
JWT_SECRET=your-secure-secret
```

**No more scattered configuration!** Everything is controlled from one file.

## API Usage

Refer to the [API Documentation](API_DOCUMENTATION.md) for detailed endpoint information, request/response formats, and examples.

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

## Quick Start Deployment

### 1. Configure AWS
```bash
# Install AWS CLI (if not installed)
brew install awscli

# Configure your AWS credentials
aws configure
```

### 2. Configure Your Deployment
```bash
# 1. Customize your configuration (optional)
# Edit config.env to change region, bucket name, etc.

# 2. Run the automated setup script
npm run setup:aws
# OR
./setup-aws.sh

# The API endpoint will be automatically saved to config.env!
```

This will create:
- S3 bucket for data storage
- IAM role and policies
- Lambda function
- API Gateway (optional)

### 3. Test Your Deployment
```bash
# Test your API endpoints automatically
./test-lambda.sh

# The test script will automatically use your API endpoint from config.env
```

### 4. Deploy Updates
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
