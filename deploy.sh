#!/bin/bash

# Feature Toggle Lambda Deployment Script

set -e

echo "🚀 Starting deployment of Feature Toggle Lambda..."

# Check if function name is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the Lambda function name"
    echo "Usage: ./deploy.sh <function-name>"
    exit 1
fi

FUNCTION_NAME=$1

echo "📦 Installing dependencies..."
npm install --production

echo "🔧 Running linting..."
if command -v eslint &> /dev/null; then
    npm run lint
else
    echo "⚠️  ESLint not found, skipping linting"
fi

echo "📁 Creating deployment package..."
zip -r deployment.zip src/ package.json node_modules/ -x "*.DS_Store" "node_modules/.cache/*"

echo "☁️  Updating Lambda function: $FUNCTION_NAME"
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://deployment.zip

echo "🧹 Cleaning up..."
rm deployment.zip

echo "✅ Deployment completed successfully!"
echo "📊 Check CloudWatch logs for function execution details"