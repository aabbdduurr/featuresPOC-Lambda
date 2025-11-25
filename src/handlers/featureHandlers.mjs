import { getPlatformFilePath, fetchS3File, writeS3File } from "../utils/s3.mjs";
import { validateData, validatePlatform, validateValueType, validateAndNormalizeSegmentCombination } from "../validation/validators.mjs";
import { featureSchema } from "../validation/schemas.mjs";
import { logFeatureAction, logFeatureValueChange, logSegmentDeletion, logSegmentReorder } from "../logging/logger.mjs";
import { deepEqual } from "../utils/helpers.mjs";

export const createFeature = async (platform, feature, user, action) => {
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
    group.features.some((f) => f.id === feature.id),
  );
  if (featureExists) {
    throw new Error(
      `Feature with id ${feature.id} already exists in platform ${platform}.`,
    );
  }

  // Find the group and add the new feature
  const group = platformData.groups.find((g) => g.id === feature.groupId);
  if (!group) {
    throw new Error(
      `Group with id ${feature.groupId} does not exist in platform ${platform}.`,
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
export const deleteFeature = async (platform, featureId, user, action) => {
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
      `Feature with id ${featureId} does not exist in platform ${platform}.`,
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
    action,
  );
};

export const changeFeatureValue = async (
  platform,
  segmentCombinationObj,
  featureId,
  featureValue,
  rollout = null, // Optional rollout info for this specific change
  user,
  action,
) => {
  if (
    !platform ||
    !segmentCombinationObj ||
    !featureId ||
    featureValue === undefined
  ) {
    throw new Error(
      "platform, segmentCombination, feature.id, and featureValue are required",
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
              "Rollout object must have percentage and secondaryValue properties",
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
              "Rollout percentage must be a number between 0 and 100",
            );
          }
        }

        // If the segment combination is empty (all segments), update the original value
        if (
          Object.values(normalizedSegmentCombination).every(
            (val) => val.length === 0,
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
            deepEqual(s.combo, normalizedSegmentCombination),
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
      `Feature with id ${featureId} does not exist in platform ${platform}.`,
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
    rollout, // Rollout info (if any)
  );
};

// Delete Segment for a Feature in a Platform
export const deleteSegmentForFeature = async (
  platform,
  segmentCombinationObj,
  featureId,
  user,
  action,
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
          deepEqual(s.combo, normalizedSegmentCombination),
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
      `Feature with id ${featureId} does not exist in platform ${platform}.`,
    );
  }

  if (!segmentDeleted) {
    throw new Error(
      `Segment combination does not exist for feature with id ${featureId} in platform ${platform}.`,
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
    normalizedSegmentCombination,
  );
};

// Reorder Segments within a Feature in a Platform
export const reorderFeatureSegments = async (
  platform,
  featureId,
  newSegmentOrder, // Array of indexes that define the new order of segments
  user,
  action,
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
            "The new segment order length must match the number of segments in the feature.",
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
      `Feature with id ${featureId} does not exist in platform ${platform}.`,
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
    newSegmentOrder,
  );
};