import { getPlatformFilePath, fetchS3File, writeS3File } from "../utils/s3.mjs";
import { validateData, validatePlatform } from "../validation/validators.mjs";
import { groupSchema } from "../validation/schemas.mjs";
import { logGroupAction } from "../logging/logger.mjs";

// Create Group for a Platform
export const createGroup = async (platform, featureGroup, user, action) => {
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
      `Group with id ${featureGroup.id} already exists in platform ${platform}.`,
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
export const deleteGroup = async (platform, groupId, user, action) => {
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
      `Group with id ${groupId} does not exist in platform ${platform}.`,
    );
  }

  // Find and remove the group
  platformData.groups = platformData.groups.filter((g) => g.id !== groupId);

  // Write updated platform file back to S3
  await writeS3File(platformFile, platformData);

  // Log the group deletion
  await logGroupAction(platform, { id: groupId }, user, action);
};