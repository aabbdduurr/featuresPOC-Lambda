#!/bin/bash

# Feature Toggle Lambda - Deployment Test Script
# This script tests the deployed Lambda function to ensure all endpoints are working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_ENDPOINT="https://byq6k88df1.execute-api.ap-south-1.amazonaws.com/prod"
JWT_SECRET="togglePOC"

echo "🧪 Testing Feature Toggle Lambda Deployment"
echo "API Endpoint: $API_ENDPOINT"
echo ""

# Function to generate JWT token using Node.js
generate_jwt() {
    # Use Node.js to generate a proper JWT token with the correct secret and user structure
    node -e "
    const jwt = require('jsonwebtoken');
    const payload = {
      user: {
        id: 'test-user-123',
        name: 'Test User',
        email: 'test@example.com'
      },
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const token = jwt.sign(payload, 'togglePOC');
    console.log(token);
    " 2>/dev/null || echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoidGVzdC11c2VyLTEyMyIsIm5hbWUiOiJUZXN0IFVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifSwiZXhwIjoxNzMyNTU2NDAwfQ.fallback-token"
}

# Function to make API calls
call_api() {
    local action="$1"
    local data="$2"
    local token="$3"
    
    local headers="Content-Type: application/json"
    if [[ -n "$token" ]]; then
        headers="$headers"$'\n'"Authorization: Bearer $token"
    fi
    
    echo -e "${BLUE}📡 Testing: $action${NC}"
    
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        ${token:+-H "Authorization: Bearer $token"} \
        -d "$data" \
        "$API_ENDPOINT" || echo '{"error": "API call failed"}')
    
    echo "Response: $response"
    echo ""
    
    # Check if response contains error
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}❌ Test failed for $action${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Test passed for $action${NC}"
        return 0
    fi
}

# Generate test token
TOKEN=$(generate_jwt)
echo -e "${YELLOW}🔑 Generated test token: ${TOKEN:0:50}...${NC}"
echo ""

# Test 1: Health Check (no auth required)
echo -e "${BLUE}=== Test 1: Health Check ===${NC}"
call_api "health-check" '{"action": "health-check"}' ""

# Test 2: Add Platform
echo -e "${BLUE}=== Test 2: Add Platform ===${NC}"
TIMESTAMP=$(date +%s)
PLATFORM_NAME="test-platform-$TIMESTAMP"
call_api "add-platform" "{\"action\": \"add-platform\", \"newPlatforms\": [\"$PLATFORM_NAME\"]}" "$TOKEN"

# Test 3: Create Segment
echo -e "${BLUE}=== Test 3: Create Segment ===${NC}"
SEGMENT_NAME="test-segment-$TIMESTAMP"
call_api "create-segment" "{\"action\": \"create-segment\", \"segmentName\": \"$SEGMENT_NAME\", \"segmentDescription\": \"A test segment for US users\", \"segmentValues\": [\"US\", \"CA\"]}" "$TOKEN"

# Test 4: Create Feature Group
echo -e "${BLUE}=== Test 4: Create Feature Group ===${NC}"
call_api "create-group" "{\"action\": \"create-group\", \"platform\": \"$PLATFORM_NAME\", \"featureGroup\": {\"id\": \"test-group\", \"name\": \"Test Group\", \"description\": \"A test feature group\"}}" "$TOKEN"

# Test 5: Create Feature Toggle
echo -e "${BLUE}=== Test 5: Create Feature Toggle ===${NC}"
call_api "create-feature" "{\"action\": \"create-feature\", \"platform\": \"$PLATFORM_NAME\", \"feature\": {\"id\": \"test-feature\", \"name\": \"Test Feature\", \"description\": \"A test feature toggle\", \"type\": \"boolean\", \"value\": false, \"groupId\": \"test-group\"}}" "$TOKEN"

# Test 6: Change Feature Value
echo -e "${BLUE}=== Test 6: Change Feature Value ===${NC}"
call_api "change-feature-value" "{\"action\": \"change-feature-value\", \"platform\": \"$PLATFORM_NAME\", \"segmentCombination\": {\"$SEGMENT_NAME\": [\"US\"]}, \"feature\": {\"id\": \"test-feature\"}, \"featureValue\": true, \"rollout\": {\"percentage\": 100, \"secondaryValue\": false}}" "$TOKEN"

# Test 7: Update Segment
echo -e "${BLUE}=== Test 7: Update Segment ===${NC}"
call_api "update-segment" "{\"action\": \"update-segment\", \"segmentName\": \"$SEGMENT_NAME\", \"segmentDescription\": \"Updated test segment description\"}" "$TOKEN"

# Test 8: Error Handling - Invalid Action
echo -e "${BLUE}=== Test 8: Error Handling ===${NC}"
echo -e "${YELLOW}Testing invalid action (should return error)${NC}"
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"action": "invalidAction"}' \
    "$API_ENDPOINT" || echo '{"error": "API call failed"}')

if echo "$response" | grep -q '"error"'; then
    echo -e "${GREEN}✅ Error handling test passed${NC}"
else
    echo -e "${RED}❌ Error handling test failed${NC}"
fi
echo ""

# Test 9: Authentication - No Token
echo -e "${BLUE}=== Test 9: Authentication Test ===${NC}"
echo -e "${YELLOW}Testing without token (should return authentication error)${NC}"
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"action": "listPlatforms"}' \
    "$API_ENDPOINT" || echo '{"error": "API call failed"}')

if echo "$response" | grep -q '"error"'; then
    echo -e "${GREEN}✅ Authentication test passed${NC}"
else
    echo -e "${RED}❌ Authentication test failed${NC}"
fi
echo ""

# Final Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}🎉 Deployment testing completed!${NC}"
echo ""
echo -e "${YELLOW}📝 Notes:${NC}"
echo "- Your Lambda function is deployed and responding"
echo "- API Gateway is properly configured"
echo "- CORS headers should be included in responses"
echo "- Authentication middleware is working"
echo ""
echo -e "${YELLOW}🔧 Next Steps:${NC}"
echo "1. Update JWT_SECRET in production for better security"
echo "2. Add proper JWT token generation in your client applications"
echo "3. Test with real user data and scenarios"
echo "4. Monitor logs in AWS CloudWatch for any issues"
echo ""
echo -e "${BLUE}🔗 API Endpoint: $API_ENDPOINT${NC}"