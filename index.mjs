import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import Ajv from "ajv";
import jwt from "jsonwebtoken";

// Constants
const VALID_TYPES = ["boolean", "number", "string"];
const BUCKET = "togglespoc";
const PLATFORMS_FILE = "platforms.json";
const SEGMENTS_FILE = "segments.json";
const PLATFORM_PATH = "platforms/";
const LOGS_PATH = "logs/";
const JWT_SECRET = "togglePOC";
const LOG_LIMIT = 100;

// AWS S3 Client
const s3Client = new S3Client({ region: "us-east-1" });
const ajv = new Ajv({ allErrors: true });

// Helper to construct platform file path
const getPlatformFilePath = (platform) => `${PLATFORM_PATH}${platform}.json`;

const deepEqual = (obj1, obj2) => {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
};

// Helper function to validate data
const validateData = (schema, data) => {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    throw new Error(`Invalid data: ${JSON.stringify(validate.errors)}`);
  }
};

const validateJwtToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization header missing or malformed");
  }

  // Extract the JWT from the "Bearer" token
  const token = authHeader.split(" ")[1];

  try {
    // Verify the token with the secret (or public key for RSA)
    const decoded = jwt.verify(token, JWT_SECRET);

    // Extract the user
    const user = decoded.user;

    if (!user) {
      throw new Error("User not found in token");
    }

    // Return an object with the user
    return {
      user,
    };
  } catch (error) {
    throw new Error("Invalid token: " + error.message);
  }
};

// Helper function to validate if a segment exists
const validateSegmentExists = (segmentsData, segmentName) => {
  if (!segmentsData[segmentName]) {
    throw new Error(`Segment with name "${segmentName}" does not exist.`);
  }
};

const validatePlatformName = (platformName) => {
  if (platformName.includes(",")) {
    throw new Error(
      `Platform name "${platformName}" cannot contain commas (",")`
    );
  }
  if (platformName.includes('"')) {
    throw new Error(
      `Platform name "${platformName}" cannot contain double quotes (")`
    );
  }
  if (platformName.length > 30) {
    throw new Error(`Platform name "${platformName}" is too long`);
  }
};

// Helper function to validate segment value type with enhanced logging
const validateSegmentValueType = (segmentValues, segments, segmentName) => {
  const existingValues = segments[segmentName].values;

  if (existingValues.length === 0) {
    throw new Error(
      `Cannot validate types for segment ${segmentName} because it has no existing values.`
    );
  }

  const segmentValuesType = typeof existingValues[0]; // Determine type of the first existing value

  segmentValues.forEach((value, index) => {
    const valueType = typeof value;
    if (valueType !== segmentValuesType) {
      throw new Error(
        `Segment value type mismatch at index ${index} for segment ${segmentName}: expected ${segmentValuesType} but got ${valueType}`
      );
    }
  });
};

// Helper function to ensure segment values are valid
const validateSegmentValues = (segmentValues) => {
  segmentValues.forEach((value) => {
    if (value.startsWith("!")) {
      throw new Error(`Segment value "${value}" cannot start with "!"`);
    }
    if (value.includes(",")) {
      throw new Error(`Segment value "${value}" cannot contain commas (",")`);
    }
    if (value.includes('"')) {
      throw new Error(
        `Segment value "${value}" cannot contain double quotes (")`
      );
    }
    if (value.length > 30) {
      throw new Error(`Segment value "${value}" is too long`);
    }
  });
};

// Fetch platforms from platforms.json and validate the platform
const validatePlatform = async (platform) => {
  const platformsData = JSON.parse(await fetchS3File(PLATFORMS_FILE));

  // Ensure platform is in the list of valid platforms
  if (!platformsData.includes(platform)) {
    throw new Error(
      `Invalid platform: ${platform}. Valid platforms are: ${platformsData.join(
        ", "
      )}`
    );
  }

  return true; // Platform is valid
};

// Helper function to validate the type of the feature value using VALID_TYPES
const validateValueType = (expectedType, value) => {
  if (!VALID_TYPES.includes(expectedType)) {
    throw new Error(`Invalid feature type: ${expectedType}`);
  }

  // Validate that the value's type matches the expected type
  if (typeof value !== expectedType) {
    throw new Error(
      `Type mismatch: expected ${expectedType} but got ${typeof value}`
    );
  }

  return true; // Type is valid
};

// Validate and normalize the segment combination
const validateAndNormalizeSegmentCombination = async (
  segmentCombinationObj
) => {
  const segmentsData = await fetchS3File(SEGMENTS_FILE);
  const segments = JSON.parse(segmentsData);

  const normalizedCombo = {};

  // Normalize keys based on the order in segments.json
  const sortedSegmentKeys = Object.keys(segments); // This defines the order

  // Check if there are any invalid keys in the segment combination
  Object.keys(segmentCombinationObj).forEach((key) => {
    if (!sortedSegmentKeys.includes(key)) {
      throw new Error(`Invalid segment key: ${key}`);
    }
  });

  sortedSegmentKeys.forEach((segmentKey) => {
    const values = segmentCombinationObj[segmentKey];

    // If segmentKey doesn't exist in the combination or has no values, skip it
    if (!values || values.length === 0) {
      return; // Do not include this segment in the normalized combination
    }

    // Ensure values is an array
    if (!Array.isArray(values)) {
      throw new Error(`Segment values for "${segmentKey}" must be an array.`);
    }

    // Ensure no duplicate values
    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length !== values.length) {
      throw new Error(`Duplicate values found for segment ${segmentKey}`);
    }

    // Validate the segment values type
    validateSegmentValueType(uniqueValues, segments, segmentKey);

    // Check for mixed negated and non-negated values in the same array
    const hasNegated = uniqueValues.some((value) => value.startsWith("!"));
    const hasNonNegated = uniqueValues.some((value) => !value.startsWith("!"));

    if (hasNegated && hasNonNegated) {
      throw new Error(
        `Mixed negated and non-negated values are not allowed for segment ${segmentKey}`
      );
    }

    // Validate each value in the array
    uniqueValues.forEach((value) => {
      if (value.startsWith("!")) {
        // Validate negated values
        const pureValue = value.slice(1); // Remove the "!" for validation
        if (!segments[segmentKey].values.includes(pureValue)) {
          throw new Error(
            `Invalid negated value for segment ${segmentKey}: ${pureValue}`
          );
        }
      } else if (!segments[segmentKey].values.includes(value)) {
        throw new Error(`Invalid value for segment ${segmentKey}: ${value}`);
      }
    });

    // Sort values to ensure consistency in the combination (e.g., ["MX", "IN"] is sorted as ["IN", "MX"])
    normalizedCombo[segmentKey] = uniqueValues.sort();
  });

  return normalizedCombo;
};

// Convert stream to string (for S3 object reads)
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });

// Fetch files from S3, with appropriate default structures for platforms and segments
const fetchS3File = async (key) => {
  try {
    const params = { Bucket: BUCKET, Key: key };
    const command = new GetObjectCommand(params);
    const data = await s3Client.send(command);
    return await streamToString(data.Body); // Convert stream to string
  } catch (error) {
    if (error.Code === "NoSuchKey") {
      // Return appropriate default structure for missing files
      if (key === PLATFORMS_FILE) {
        return JSON.stringify([]); // Default: empty array for platforms.json
      } else if (key === SEGMENTS_FILE) {
        return JSON.stringify({}); // Default: empty object for segments.json
      } else if (key.startsWith("platforms/")) {
        return JSON.stringify({ groups: [] }); // Default structure for platform-specific files
      } else if (key.startsWith("logs/")) {
        return JSON.stringify([]); // Default structure for log files
      }
    }
    throw error; // Re-throw other errors
  }
};

// Helper function to write files to S3
const writeS3File = async (key, body) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(body),
    ContentType: "application/json",
  };
  await s3Client.send(new PutObjectCommand(params));
};

// Helper function to create a simple log entry
const createLogEntry = (user, action, details = {}) => {
  if (!user || !user.email) {
    throw new Error("User email is required");
  }

  return {
    user: user.email,
    action,
    timestamp: new Date().toISOString(),
    ...details, // Spread any additional details passed in (like segment, value, rollout)
  };
};

const appendLogToS3 = async (filePath, logEntry) => {
  // Fetch existing logs from S3
  let logs = JSON.parse(await fetchS3File(filePath));

  // Append the new log entry
  logs.push(logEntry);

  // Enforce the log limit, keeping only the most recent entries
  if (logs.length > LOG_LIMIT) {
    logs = logs.slice(logs.length - LOG_LIMIT); // Keep only the last LOG_LIMIT entries
  }

  // Write the updated log array back to S3
  await writeS3File(filePath, logs);
};

// Logging for group actions (creation/deletion)
const logGroupAction = async (platform, group, user, action) => {
  const logEntry = createLogEntry(user, action); // No need for extra details
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}.json`; // File structure includes platform/group
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for feature actions (creation/deletion)
const logFeatureAction = async (platform, group, feature, user, action) => {
  const logEntry = createLogEntry(user, action); // Simple log
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // File structure includes platform/group/feature
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for feature value change, including segments and rollout (if any)
const logFeatureValueChange = async (
  platform,
  group,
  feature,
  user,
  action,
  segment = null,
  value,
  rollout = null
) => {
  const logEntry = createLogEntry(user, action, {
    segment,
    value,
    rollout,
  });
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // Same file path structure
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for segment deletion
const logSegmentDeletion = async (
  platform,
  group,
  feature,
  user,
  action,
  segment
) => {
  const logEntry = createLogEntry(user, action, {
    segment, // Include segment details
  });
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // Log file for the feature
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for segment reorder
const logSegmentReorder = async (
  platform,
  group,
  feature,
  user,
  action,
  order
) => {
  const logEntry = createLogEntry(user, action, {
    order, // Include order
  });
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // Log file for the feature
  await appendLogToS3(logFilePath, logEntry);
};

// Schema for segment creation and update
const segmentSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    values: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["name", "description", "values"],
};

// Schema for segment update (only description is required)
const segmentUpdateSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
  },
  required: ["name", "description"],
};

// Validation schemas
const groupSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    features: { type: "array" },
  },
  required: ["id", "description"],
};

const featureSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    type: { type: "string", enum: VALID_TYPES },
    value: {},
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          combo: { type: "object" }, // As object now, not a string
          value: {},
          rollout: {
            // New rollout property
            type: "object",
            properties: {
              percentage: { type: "number", minimum: 0, maximum: 100 },
              secondaryValue: {},
            },
            required: ["percentage", "secondaryValue"],
          },
        },
        required: ["combo", "value"],
      },
    },
    rollout: {
      // Main level rollout if no segments
      type: "object",
      properties: {
        percentage: { type: "number", minimum: 0, maximum: 100 },
        secondaryValue: {},
      },
      required: ["percentage", "secondaryValue"],
    },
  },
  required: ["id", "description", "type", "value"],
};

// Main Lambda Handler
export const handler = async (event) => {
  try {
    // Extract the authorization header
    const authHeader =
      event.headers.Authorization || event.headers.authorization;

    // Validate the JWT and extract user information
    const { user } = validateJwtToken(authHeader);

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
          action
        );
        break;
      case "delete-segment-for-feature":
        await deleteSegmentForFeature(
          platform,
          segmentCombination,
          feature.id,
          user,
          action
        );
        break;
      case "reorder-feature-segments":
        await reorderFeatureSegments(
          platform,
          feature.id,
          newSegmentOrder,
          user,
          action
        );
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Invalid action" }),
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Operation successful" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};

// Add new platform(s) to platforms.json
const addPlatform = async (newPlatforms) => {
  if (!newPlatforms || !Array.isArray(newPlatforms)) {
    throw new Error("newPlatforms is required and must be an array.");
  }

  if (newPlatforms.length === 0) {
    throw new Error("At least one platform name is required.");
  }

  // Validate each new platform name
  newPlatforms.forEach(validatePlatformName);

  // Fetch existing platforms data
  let platformsData = JSON.parse(await fetchS3File(PLATFORMS_FILE));

  // Check for duplicates in the new platforms and existing platforms
  newPlatforms.forEach((platform) => {
    if (platformsData.includes(platform)) {
      throw new Error(`Platform "${platform}" already exists.`);
    }
  });

  // Add the new platforms to the existing platforms data
  platformsData.push(...newPlatforms);

  // Write the updated platforms file back to S3
  await writeS3File(PLATFORMS_FILE, platformsData);
};

// Create a new segment
const createSegment = async (
  segmentName,
  segmentDescription,
  segmentValues
) => {
  if (
    !segmentName ||
    !segmentDescription ||
    !segmentValues ||
    segmentValues.length === 0
  ) {
    throw new Error(
      "segmentName, segmentDescription, and non-empty segmentValues are required."
    );
  }

  // Ensure values are valid
  validateSegmentValues(segmentValues);

  // Validate segment data with schema
  validateData(segmentSchema, {
    name: segmentName,
    description: segmentDescription,
    values: segmentValues,
  });

  // Fetch existing segments data
  const segmentsData = JSON.parse(await fetchS3File(SEGMENTS_FILE));

  // Check if the segment already exists
  if (segmentsData[segmentName]) {
    throw new Error(`Segment with name "${segmentName}" already exists.`);
  }

  // Add the new segment
  segmentsData[segmentName] = {
    description: segmentDescription,
    values: segmentValues,
  };

  // Write updated segments file back to S3
  await writeS3File(SEGMENTS_FILE, segmentsData);
};

// Update an existing segment's description
const updateSegment = async (segmentName, segmentDescription) => {
  if (!segmentName || !segmentDescription) {
    throw new Error("segmentName and segmentDescription are required.");
  }

  // Validate segment update data with schema
  validateData(segmentUpdateSchema, {
    name: segmentName,
    description: segmentDescription,
  });

  // Fetch existing segments data
  const segmentsData = JSON.parse(await fetchS3File(SEGMENTS_FILE));

  // Validate if the segment exists
  validateSegmentExists(segmentsData, segmentName);

  // Update the segment's description
  segmentsData[segmentName].description = segmentDescription;

  // Write updated segments file back to S3
  await writeS3File(SEGMENTS_FILE, segmentsData);
};

// Add new values to an existing segment
const addSegmentValues = async (segmentName, segmentValues) => {
  if (!segmentName || !segmentValues || segmentValues.length === 0) {
    throw new Error("segmentName and non-empty segmentValues are required.");
  }

  // Fetch existing segments data
  const segmentsData = JSON.parse(await fetchS3File(SEGMENTS_FILE));

  // Validate type match for new values
  validateSegmentValueType(segmentValues, segmentsData, segmentName);

  // Ensure values are valid
  validateSegmentValues(segmentValues);

  // Validate values (string array) using schema
  validateData(segmentSchema, {
    name: segmentName,
    description: "",
    values: segmentValues,
  });

  // Validate if the segment exists
  validateSegmentExists(segmentsData, segmentName);

  // Add the new values (only add if they don't already exist)
  segmentsData[segmentName].values = [
    ...new Set([...segmentsData[segmentName].values, ...segmentValues]),
  ];

  // Write updated segments file back to S3
  await writeS3File(SEGMENTS_FILE, segmentsData);
};

// Create Group for a Platform
const createGroup = async (platform, featureGroup, user, action) => {
  if (!platform || !featureGroup) {
    throw new Error("platform and featureGroup are required");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  // Validate group data
  validateData(groupSchema, featureGroup);

  // if features are provided, throw an error
  if (featureGroup.features) {
    throw new Error("Features cannot be provided during group creation.");
  }

  // Check if the group ID already exists
  const groupExists = platformData.groups.some((g) => g.id === featureGroup.id);
  if (groupExists) {
    throw new Error(
      `Group with id ${featureGroup.id} already exists in platform ${platform}.`
    );
  }

  // Add the new group
  platformData.groups.push({
    id: featureGroup.id,
    description: featureGroup.description,
    features: [],
  });

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the group creation
  await logGroupAction(platform, featureGroup, user, action);
};

// Delete Group from a Platform
const deleteGroup = async (platform, groupId, user, action) => {
  if (!platform || !groupId) {
    throw new Error("platform and featureGroup.id are required");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  // Check if the group exists
  const groupExists = platformData.groups.some((g) => g.id === groupId);
  if (!groupExists) {
    throw new Error(
      `Group with id ${groupId} does not exist in platform ${platform}.`
    );
  }

  // Find and remove the group
  platformData.groups = platformData.groups.filter((g) => g.id !== groupId);

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the group deletion
  await logGroupAction(platform, { id: groupId }, user, action);
};

const createFeature = async (platform, feature, user, action) => {
  if (!platform || !feature) {
    throw new Error("platform and feature are required");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  // Validate feature data including rollout properties
  validateData(featureSchema, feature);

  // Validate the feature's value type
  validateValueType(feature.type, feature.value);

  // Validate the feature's secondary value type if provided
  if (feature.rollout) {
    validateValueType(feature.type, feature.rollout.secondaryValue);
  }

  // if segment is provided, throw an error
  if (feature.segments) {
    throw new Error("Segments cannot be provided during feature creation.");
  }

  // Ensure the feature ID is globally unique in this platform
  const featureExists = platformData.groups.some((group) =>
    group.features.some((f) => f.id === feature.id)
  );
  if (featureExists) {
    throw new Error(
      `Feature with id ${feature.id} already exists in platform ${platform}.`
    );
  }

  // Find the group and add the new feature
  const group = platformData.groups.find((g) => g.id === feature.groupId);
  if (!group) {
    throw new Error(
      `Group with id ${feature.groupId} does not exist in platform ${platform}.`
    );
  }

  // Add the feature along with the rollout data
  group.features.push({
    id: feature.id,
    description: feature.description,
    type: feature.type,
    value: feature.value,
    segments: [],
    rollout: feature.rollout
      ? {
          percentage: feature.rollout.percentage,
          secondaryValue: feature.rollout.secondaryValue,
        }
      : null,
  });

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the feature creation
  await logFeatureAction(platform, group, feature, user, action);
};

// Delete Feature from a Group for a Platform
const deleteFeature = async (platform, featureId, user, action) => {
  if (!platform || !featureId) {
    throw new Error("platform and feature.id are required");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  let featureFound = false;
  let featureGroup = null;

  platformData.groups = platformData.groups.map((group) => {
    const updatedFeatures = group.features.filter((f) => f.id !== featureId);
    if (updatedFeatures.length !== group.features.length) {
      featureFound = true;
      featureGroup = group;
    }
    return { ...group, features: updatedFeatures };
  });

  if (!featureFound) {
    throw new Error(
      `Feature with id ${featureId} does not exist in platform ${platform}.`
    );
  }

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the feature deletion
  await logFeatureAction(
    platform,
    featureGroup,
    { id: featureId },
    user,
    action
  );
};

const changeFeatureValue = async (
  platform,
  segmentCombinationObj,
  featureId,
  featureValue,
  rollout = null, // Optional rollout info for this specific change
  user,
  action
) => {
  if (
    !platform ||
    !segmentCombinationObj ||
    !featureId ||
    featureValue === undefined
  ) {
    throw new Error(
      "platform, segmentCombination, feature.id, and featureValue are required"
    );
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  // Normalize and validate the segment combination
  const normalizedSegmentCombination =
    await validateAndNormalizeSegmentCombination(segmentCombinationObj);

  let featureFound = false;
  let featureGroup = null;

  platformData.groups.forEach((group) => {
    group.features.forEach((feature) => {
      if (feature.id === featureId) {
        featureFound = true;
        featureGroup = group;

        // Validate the feature's value type
        validateValueType(feature.type, featureValue);

        // If the rollout is provided, validate its properties
        if (rollout) {
          // Validate that both percentage and secondaryValue exist (0 is valid, but undefined is not)
          if (
            rollout.percentage === undefined ||
            rollout.secondaryValue === undefined
          ) {
            throw new Error(
              "Rollout object must have percentage and secondaryValue properties"
            );
          }

          // Validate the feature's secondary value type if provided
          validateValueType(feature.type, rollout.secondaryValue);

          // Validate that the rollout percentage is a number and within valid range
          if (
            typeof rollout.percentage !== "number" ||
            rollout.percentage < 0 ||
            rollout.percentage > 100
          ) {
            throw new Error(
              "Rollout percentage must be a number between 0 and 100"
            );
          }
        }

        // If the segment combination is empty (all segments), update the original value
        if (
          Object.values(normalizedSegmentCombination).every(
            (val) => val.length === 0
          )
        ) {
          feature.value = featureValue;

          // Update or remove rollout based on whether it's provided
          feature.rollout = rollout
            ? {
                percentage: rollout.percentage,
                secondaryValue: rollout.secondaryValue,
              }
            : null; // Reset rollout to null if not provided
        } else {
          // Check if a segment combo already exists by comparing the objects directly
          const segmentIndex = feature.segments.findIndex((s) =>
            deepEqual(s.combo, normalizedSegmentCombination)
          );

          if (segmentIndex !== -1) {
            // Segment exists, Update the segment's value and rollout info
            feature.segments[segmentIndex].value = featureValue;
            feature.segments[segmentIndex].rollout = rollout
              ? {
                  percentage: rollout.percentage,
                  secondaryValue: rollout.secondaryValue,
                }
              : null; // Reset rollout to null if not provided
          } else {
            // Segment doesn't exist, add it
            feature.segments.unshift({
              combo: normalizedSegmentCombination,
              value: featureValue,
              rollout: rollout
                ? {
                    percentage: rollout.percentage,
                    secondaryValue: rollout.secondaryValue,
                  }
                : null,
            });
          }
        }
      }
    });
  });

  if (!featureFound) {
    throw new Error(
      `Feature with id ${featureId} does not exist in platform ${platform}.`
    );
  }

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the feature value change (including segment and rollout info)
  await logFeatureValueChange(
    platform,
    featureGroup,
    { id: featureId },
    user,
    action,
    Object.keys(normalizedSegmentCombination).length > 0
      ? normalizedSegmentCombination
      : null, // Segment info
    featureValue, // New value
    rollout // Rollout info (if any)
  );
};

// Delete Segment for a Feature in a Platform
const deleteSegmentForFeature = async (
  platform,
  segmentCombinationObj,
  featureId,
  user,
  action
) => {
  if (!platform || !segmentCombinationObj || !featureId) {
    throw new Error("platform, segmentCombination, and featureId are required");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  // Normalize and validate the segment combination
  const normalizedSegmentCombination =
    await validateAndNormalizeSegmentCombination(segmentCombinationObj);

  let featureFound = false;
  let segmentDeleted = false;
  let featureGroup = null;

  platformData.groups.forEach((group) => {
    group.features.forEach((feature) => {
      if (feature.id === featureId) {
        featureFound = true;
        featureGroup = group;

        // Check if a segment combo exists by comparing the objects directly
        const segmentIndex = feature.segments.findIndex((s) =>
          deepEqual(s.combo, normalizedSegmentCombination)
        );

        if (segmentIndex !== -1) {
          // Segment exists, remove it
          feature.segments.splice(segmentIndex, 1);
          segmentDeleted = true;
        }
      }
    });
  });

  if (!featureFound) {
    throw new Error(
      `Feature with id ${featureId} does not exist in platform ${platform}.`
    );
  }

  if (!segmentDeleted) {
    throw new Error(
      `Segment combination does not exist for feature with id ${featureId} in platform ${platform}.`
    );
  }

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the segment deletion
  await logSegmentDeletion(
    platform,
    featureGroup,
    { id: featureId },
    user,
    action,
    normalizedSegmentCombination
  );
};

// Reorder Segments within a Feature in a Platform
const reorderFeatureSegments = async (
  platform,
  featureId,
  newSegmentOrder, // Array of indexes that define the new order of segments
  user,
  action
) => {
  if (!platform || !featureId || !Array.isArray(newSegmentOrder)) {
    throw new Error("platform, featureId, and newSegmentOrder are required.");
  }

  // Validate if all indexes are numbers
  if (!newSegmentOrder.every((index) => typeof index === "number")) {
    throw new Error("All indexes in newSegmentOrder must be numbers.");
  }

  // Validate platform
  await validatePlatform(platform);

  const platformFile = getPlatformFilePath(platform);
  const platformData = JSON.parse(await fetchS3File(platformFile));

  let featureFound = false;
  let featureGroup = null;

  platformData.groups.forEach((group) => {
    group.features.forEach((feature) => {
      if (feature.id === featureId) {
        featureFound = true;
        featureGroup = group;

        // Ensure the new segment order is valid
        if (newSegmentOrder.length !== feature.segments.length) {
          throw new Error(
            "The new segment order length must match the number of segments in the feature."
          );
        }

        // Reorder the segments based on the newSegmentOrder
        const reorderedSegments = newSegmentOrder.map((index) => {
          if (index >= feature.segments.length || index < 0) {
            throw new Error(`Invalid index: ${index} in newSegmentOrder.`);
          }
          return feature.segments[index];
        });

        // Update the feature's segments array
        feature.segments = reorderedSegments;
      }
    });
  });

  if (!featureFound) {
    throw new Error(
      `Feature with id ${featureId} does not exist in platform ${platform}.`
    );
  }

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the segment reorder
  await logSegmentReorder(
    platform,
    featureGroup,
    { id: featureId },
    user,
    action,
    newSegmentOrder
  );
};
