# Feature Toggle Lambda API Documentation

## API Endpoint
```
https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

## Authentication

All operations (except health checks) require JWT authentication:

```bash
# First, generate a JWT token using the secret "togglePOC"
# Token should contain: { "user": { "email": "user@example.com" } }

curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{"action": "your-action"}' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

## Supported Operations

### 1. Health Check (No Auth Required)

#### GET Request
```bash
curl https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

#### POST Request  
```bash
curl -H "Content-Type: application/json" \
     -X POST \
     --data '{"action": "health-check"}' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

**Response:**
```json
{
  "message": "Feature Toggle Lambda is healthy",
  "timestamp": "2025-11-25T13:19:36.411Z",
  "version": "1.0.0"
}
```

---

## Platform Management

### 2. Add Platform

**Action:** `add-platform`

**Payload:**
```json
{
  "action": "add-platform",
  "newPlatforms": ["platform-name-1", "platform-name-2"]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "add-platform",
       "newPlatforms": ["mobile-app", "web-dashboard"]
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

---

## Segment Management

### 3. Create Segment

**Action:** `create-segment`

**Payload:**
```json
{
  "action": "create-segment",
  "segmentName": "segment-name",
  "segmentDescription": "Description of the segment",
  "segmentValues": ["value1", "value2", "value3"]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "create-segment",
       "segmentName": "user-tier",
       "segmentDescription": "User subscription tiers",
       "segmentValues": ["free", "premium", "enterprise"]
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 4. Update Segment

**Action:** `update-segment`

**Payload:**
```json
{
  "action": "update-segment",
  "segmentName": "existing-segment-name",
  "segmentDescription": "New description"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "update-segment",
       "segmentName": "user-tier",
       "segmentDescription": "Updated user subscription tiers"
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 5. Add Segment Values

**Action:** `add-segment-values`

**Payload:**
```json
{
  "action": "add-segment-values",
  "segmentName": "existing-segment-name",
  "segmentValues": ["new-value1", "new-value2"]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "add-segment-values",
       "segmentName": "user-tier",
       "segmentValues": ["trial", "student"]
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

---

## Group Management

### 6. Create Group

**Action:** `create-group`

**Payload:**
```json
{
  "action": "create-group",
  "platform": "platform-name",
  "featureGroup": {
    "id": "group-id",
    "description": "Group description"
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "create-group",
       "platform": "mobile-app",
       "featureGroup": {
         "id": "ui-features",
         "description": "User Interface Features"
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 7. Delete Group

**Action:** `delete-group`

**Payload:**
```json
{
  "action": "delete-group",
  "platform": "platform-name",
  "featureGroup": {
    "id": "group-id-to-delete"
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "delete-group",
       "platform": "mobile-app",
       "featureGroup": {
         "id": "ui-features"
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

---

## Feature Management

### 8. Create Feature

**Action:** `create-feature`

**Payload:**
```json
{
  "action": "create-feature",
  "platform": "platform-name",
  "feature": {
    "id": "feature-id",
    "groupId": "group-id",
    "description": "Feature description",
    "type": "boolean|string|number",
    "value": true,
    "rollout": {
      "percentage": 50,
      "secondaryValue": false
    }
  }
}
```

**Example (Boolean Feature):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "create-feature",
       "platform": "mobile-app",
       "feature": {
         "id": "new-dashboard",
         "groupId": "ui-features",
         "description": "Enable new dashboard design",
         "type": "boolean",
         "value": true,
         "rollout": {
           "percentage": 25,
           "secondaryValue": false
         }
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

**Example (String Feature):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "create-feature",
       "platform": "mobile-app",
       "feature": {
         "id": "theme-color",
         "groupId": "ui-features",
         "description": "Primary theme color",
         "type": "string",
         "value": "#007AFF"
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 9. Delete Feature

**Action:** `delete-feature`

**Payload:**
```json
{
  "action": "delete-feature",
  "platform": "platform-name",
  "feature": {
    "id": "feature-id-to-delete"
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "delete-feature",
       "platform": "mobile-app",
       "feature": {
         "id": "old-feature"
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 10. Change Feature Value

**Action:** `change-feature-value`

**Payload:**
```json
{
  "action": "change-feature-value",
  "platform": "platform-name",
  "feature": {
    "id": "feature-id"
  },
  "featureValue": "new-value",
  "rollout": {
    "percentage": 75,
    "secondaryValue": "fallback-value"
  },
  "segmentCombination": {
    "segment1": ["value1"],
    "segment2": ["value2", "!excluded-value"]
  }
}
```

**Example (Global Change):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "change-feature-value",
       "platform": "mobile-app",
       "feature": {
         "id": "new-dashboard"
       },
       "featureValue": true,
       "rollout": {
         "percentage": 50,
         "secondaryValue": false
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

**Example (Segment-specific Change):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "change-feature-value",
       "platform": "mobile-app",
       "feature": {
         "id": "premium-features"
       },
       "featureValue": true,
       "segmentCombination": {
         "user-tier": ["premium"],
         "region": ["us"]
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

**Example (Using "Not In" Logic):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "change-feature-value",
       "platform": "mobile-app",
       "feature": {
         "id": "premium-features"
       },
       "featureValue": false,
       "segmentCombination": {
         "user-tier": ["!free", "!trial"],
         "region": ["us", "ca"]
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 11. Delete Segment for Feature

**Action:** `delete-segment-for-feature`

**Payload:**
```json
{
  "action": "delete-segment-for-feature",
  "platform": "platform-name",
  "feature": {
    "id": "feature-id"
  },
  "segmentCombination": {
    "segment1": ["value1"],
    "segment2": ["value2"]
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "delete-segment-for-feature",
       "platform": "mobile-app",
       "feature": {
         "id": "premium-features"
       },
       "segmentCombination": {
         "user-tier": ["trial"]
       }
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

### 12. Reorder Feature Segments

**Action:** `reorder-feature-segments`

**Payload:**
```json
{
  "action": "reorder-feature-segments",
  "platform": "platform-name",
  "feature": {
    "id": "feature-id"
  },
  "newSegmentOrder": [
    {"segment1": ["value1"], "segment2": ["value2"]},
    {"segment1": ["value3"]},
    {"segment2": ["value4"], "segment3": ["value5"]}
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -X POST \
     --data '{
       "action": "reorder-feature-segments",
       "platform": "mobile-app",
       "feature": {
         "id": "premium-features"
       },
       "newSegmentOrder": [
         ["user-tier:enterprise"],
         ["user-tier:premium", "region:us"],
         ["user-tier:premium"]
       ]
     }' \
     https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod
```

---

## JWT Token Generation

To generate a valid JWT token for testing, create a Node.js script:

```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = "togglePOC";
const userPayload = {
  user: {
    email: "user@example.com",
    name: "Test User"
  }
};

const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
console.log('Bearer', token);
```

Or use an online JWT generator with:
- **Header:** `{"alg":"HS256","typ":"JWT"}`
- **Payload:** `{"user":{"email":"user@example.com"}}`
- **Secret:** `togglePOC`

---

## Success Response

All successful operations return:

```json
{
  "message": "Operation successful"
}
```

## Error Responses

### Authentication Error (401):
```json
{
  "error": "Internal server error",
  "details": "Authorization header missing or malformed"
}
```

### Validation Error (500):
```json
{
  "error": "Internal server error",
  "details": "Platform 'invalid-platform' does not exist."
}
```

### Invalid Action (400):
```json
{
  "message": "Invalid action"
}
```

---

## Data Types

### Feature Value Types:
- **boolean:** `true` or `false`
- **string:** Any string value `"example"`
- **number:** Any numeric value `42` or `3.14`

### Segment Combination Format:
Object with segment names as keys and arrays of values:
```json
{
  "user-tier": ["premium"],
  "region": ["us"],
  "device": ["mobile"]
}
```

### "Not In" Logic:
Use `!` prefix for negated values:
```json
{
  "user-tier": ["!free", "!trial"],
  "region": ["us", "ca"]
}
```

### Rollout Object:
```json
{
  "percentage": 50,
  "secondaryValue": false
}
```
- `percentage`: 0-100, percentage of users getting primary value
- `secondaryValue`: Value for remaining percentage of users