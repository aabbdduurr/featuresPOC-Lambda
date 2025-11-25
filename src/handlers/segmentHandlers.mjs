import { SEGMENTS_FILE } from "../config/constants.mjs";
import { fetchS3File, writeS3File } from "../utils/s3.mjs";
import { validateData, validateSegmentExists, validateSegmentValues, validateSegmentValueType } from "../validation/validators.mjs";
import { segmentSchema, segmentUpdateSchema } from "../validation/schemas.mjs";

// Create a new segment
export const createSegment = async (
  segmentName,
  segmentDescription,
  segmentValues,
) => {
  if (
    !segmentName ||
    !segmentDescription ||
    !segmentValues ||
    segmentValues.length === 0
  ) {
    throw new Error(
      "segmentName, segmentDescription, and non-empty segmentValues are required.",
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
export const updateSegment = async (segmentName, segmentDescription) => {
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
export const addSegmentValues = async (segmentName, segmentValues) => {
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