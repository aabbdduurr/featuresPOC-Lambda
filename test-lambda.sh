#!/bin/bash

# Test script for Feature Toggle Lambda
# This script tests various endpoints of your deployed Lambda function

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
LAMBDA_ENDPOINT=""  # Will be set by user input or API Gateway URL
JWT_TOKEN=""        # Will be set by user input

echo -e "${BLUE}🧪 Feature Toggle Lambda Test Script${NC}"
echo ""

# Get endpoint from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter your Lambda endpoint URL:${NC}"
    echo "  (API Gateway URL or direct Lambda function URL)"
    read -r LAMBDA_ENDPOINT
else
    LAMBDA_ENDPOINT="$1"
fi

# Get JWT token from user
if [ -z "$2" ]; then
    echo -e "${YELLOW}Enter your JWT token:${NC}"
    echo "  (Use a test token - this demo doesn't validate real users)"
    echo "  Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImVtYWlsIjoidGVzdEB0ZXN0LmNvbSJ9fQ.test"
    read -r JWT_TOKEN
else
    JWT_TOKEN="$2"
fi

echo ""
echo -e "${BLUE}🚀 Starting tests...${NC}"

# Test 1: Add Platform
echo -e "${BLUE}Test 1: Adding platforms${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LAMBDA_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "action": "add-platform",
    "newPlatforms": ["WEB", "MOBILE"]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Platform creation successful${NC}"
else
    echo -e "${RED}❌ Platform creation failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

# Test 2: Create Segment
echo -e "${BLUE}Test 2: Creating segment${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LAMBDA_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "action": "create-segment",
    "segmentName": "country",
    "segmentDescription": "User Country",
    "segmentValues": ["US", "UK", "CA"]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Segment creation successful${NC}"
else
    echo -e "${RED}❌ Segment creation failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 3: Create Group
echo -e "${BLUE}Test 3: Creating feature group${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LAMBDA_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "action": "create-group",
    "platform": "WEB",
    "featureGroup": {
      "id": "ui-features",
      "description": "UI Feature Toggles"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Group creation successful${NC}"
else
    echo -e "${RED}❌ Group creation failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 4: Create Feature
echo -e "${BLUE}Test 4: Creating feature${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LAMBDA_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
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
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Feature creation successful${NC}"
else
    echo -e "${RED}❌ Feature creation failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 5: Change Feature Value
echo -e "${BLUE}Test 5: Changing feature value${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$LAMBDA_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "action": "change-feature-value",
    "platform": "WEB",
    "feature": {"id": "new-checkout"},
    "segmentCombination": {"country": ["US"]},
    "featureValue": true
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Feature value change successful${NC}"
else
    echo -e "${RED}❌ Feature value change failed (HTTP $HTTP_CODE)${NC}"
fi

echo ""
echo -e "${BLUE}🎉 Test suite completed!${NC}"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  - Check AWS CloudWatch logs for detailed error messages"
echo "  - Verify S3 bucket contents to see stored data"
echo "  - Use AWS Lambda console to test individual functions"

# Create a simple JWT token generator for testing
echo ""
echo -e "${BLUE}🔧 Need a test JWT token? Use this Node.js snippet:${NC}"
cat << 'EOF'

// Generate test JWT (run this in Node.js)
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { user: { email: 'test@example.com' } },
  'togglePOC',  // Your JWT_SECRET
  { expiresIn: '1d' }
);
console.log('Bearer ' + token);

EOF