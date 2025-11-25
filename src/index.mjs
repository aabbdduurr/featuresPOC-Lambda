import { validateJwtToken } from "./utils/auth.mjs";
import { addPlatform } from "./handlers/platformHandlers.mjs";
import { createSegment, updateSegment, addSegmentValues } from "./handlers/segmentHandlers.mjs";
import { createGroup, deleteGroup } from "./handlers/groupHandlers.mjs";
import { 
  createFeature, 
  deleteFeature, 
  changeFeatureValue, 
  deleteSegmentForFeature, 
  reorderFeatureSegments, 
} from "./handlers/featureHandlers.mjs";

// Main Lambda Handler
export const handler = async (event) => {
  try {
    // Handle OPTIONS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        body: JSON.stringify({ message: "Preflight OK" }),
      };
    }

    // Handle GET requests for health check
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          message: "Feature Toggle Lambda is healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0"
        }),
      };
    }

    // Parse body for POST requests
    const {
      action,
      platform,
      feature,
      featureValue,
      featureGroup,
      segmentName,
      segmentDescription,
      segmentValues,
      segmentCombination,
      rollout,
      newSegmentOrder,
      newPlatforms,
    } = JSON.parse(event.body);

    // Handle health-check action without authentication
    if (action === 'health-check') {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          message: "Feature Toggle Lambda is healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0"
        }),
      };
    }

    // For all other actions, validate JWT
    const authHeader =
      event.headers.Authorization || event.headers.authorization;

    // Validate the JWT and extract user information
    const { user } = validateJwtToken(authHeader);

    switch (action) {
    case "add-platform":
      await addPlatform(newPlatforms);
      break;
    case "create-segment":
      await createSegment(segmentName, segmentDescription, segmentValues);
      break;
    case "update-segment":
      await updateSegment(segmentName, segmentDescription);
      break;
    case "add-segment-values":
      await addSegmentValues(segmentName, segmentValues);
      break;
    case "create-group":
      await createGroup(platform, featureGroup, user, action);
      break;
    case "delete-group":
      await deleteGroup(platform, featureGroup.id, user, action);
      break;
    case "create-feature":
      await createFeature(platform, feature, user, action);
      break;
    case "delete-feature":
      await deleteFeature(platform, feature.id, user, action);
      break;
    case "change-feature-value":
      await changeFeatureValue(
        platform,
        segmentCombination,
        feature.id,
        featureValue,
        rollout,
        user,
        action,
      );
      break;
    case "delete-segment-for-feature":
      await deleteSegmentForFeature(
        platform,
        segmentCombination,
        feature.id,
        user,
        action,
      );
      break;
    case "reorder-feature-segments":
      await reorderFeatureSegments(
        platform,
        feature.id,
        newSegmentOrder,
        user,
        action,
      );
      break;
    default:
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        body: JSON.stringify({ message: "Invalid action" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: JSON.stringify({ message: "Operation successful" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};