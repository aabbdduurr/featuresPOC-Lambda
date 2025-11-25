import { ajv } from "../config/aws.mjs";
import { VALID_TYPES, PLATFORMS_FILE, SEGMENTS_FILE } from "../config/constants.mjs";
import { fetchS3File } from "../utils/s3.mjs";

// Helper function to validate data
export const validateData = (schema, data) => {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    throw new Error(`Invalid data: ${JSON.stringify(validate.errors)}`);
  }
};

// Helper function to validate if a segment exists
export const validateSegmentExists = (segmentsData, segmentName) => {
  if (!segmentsData[segmentName]) {
    throw new Error(`Segment with name "${segmentName}" does not exist.`);
  }
};

export const validatePlatformName = (platformName) => {
  if (platformName.includes(",")) {
    throw new Error(
      `Platform name "${platformName}" cannot contain commas (",")`,
    );
  }
  if (platformName.includes("\"")) {
    throw new Error(
      `Platform name "${platformName}" cannot contain double quotes (")`,
    );
  }
  if (platformName.length > 30) {
    throw new Error(`Platform name "${platformName}" is too long`);
  }
};

// Helper function to validate segment value type with enhanced logging
export const validateSegmentValueType = (segmentValues, segments, segmentName) => {
  const existingValues = segments[segmentName].values;

  if (existingValues.length === 0) {
    throw new Error(
      `Cannot validate types for segment ${segmentName} because it has no existing values.`,
    );
  }

  const segmentValuesType = typeof existingValues[0]; // Determine type of the first existing value

  segmentValues.forEach((value, index) => {
    const valueType = typeof value;
    if (valueType !== segmentValuesType) {
      throw new Error(
        `Segment value type mismatch at index ${index} for segment ${segmentName}: expected ${segmentValuesType} but got ${valueType}`,
      );
    }
  });
};

// Helper function to ensure segment values are valid
export const validateSegmentValues = (segmentValues) => {
  segmentValues.forEach((value) => {
    if (value.startsWith("!")) {
      throw new Error(`Segment value "${value}" cannot start with "!"`);
    }
    if (value.includes(",")) {
      throw new Error(`Segment value "${value}" cannot contain commas (",")`);
    }
    if (value.includes("\"")) {
      throw new Error(
        `Segment value "${value}" cannot contain double quotes (")`,
      );
    }
    if (value.length > 30) {
      throw new Error(`Segment value "${value}" is too long`);
    }
  });
};

// Fetch platforms from platforms.json and validate the platform
export const validatePlatform = async (platform) => {
  const platformsData = JSON.parse(await fetchS3File(PLATFORMS_FILE));

  // Ensure platform is in the list of valid platforms
  if (!platformsData.includes(platform)) {
    throw new Error(
      `Invalid platform: ${platform}. Valid platforms are: ${platformsData.join(
        ", ",
      )}`,
    );
  }

  return true; // Platform is valid
};

// Helper function to validate the type of the feature value using VALID_TYPES
export const validateValueType = (expectedType, value) => {
  if (!VALID_TYPES.includes(expectedType)) {
    throw new Error(`Invalid feature type: ${expectedType}`);
  }

  // Validate that the value's type matches the expected type
  if (typeof value !== expectedType) {
    throw new Error(
      `Type mismatch: expected ${expectedType} but got ${typeof value}`,
    );
  }

  return true; // Type is valid
};

// Validate and normalize the segment combination
export const validateAndNormalizeSegmentCombination = async (
  segmentCombinationObj,
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
        `Mixed negated and non-negated values are not allowed for segment ${segmentKey}`,
      );
    }

    // Validate each value in the array
    uniqueValues.forEach((value) => {
      if (value.startsWith("!")) {
        // Validate negated values
        const pureValue = value.slice(1); // Remove the "!" for validation
        if (!segments[segmentKey].values.includes(pureValue)) {
          throw new Error(
            `Invalid negated value for segment ${segmentKey}: ${pureValue}`,
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