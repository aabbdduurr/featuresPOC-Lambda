import { PLATFORMS_FILE } from "../config/constants.mjs";
import { fetchS3File, writeS3File } from "../utils/s3.mjs";
import { validatePlatformName } from "../validation/validators.mjs";

// Add new platform(s) to platforms.json
export const addPlatform = async (newPlatforms) => {
  if (!newPlatforms || !Array.isArray(newPlatforms)) {
    throw new Error("newPlatforms is required and must be an array.");
  }

  if (newPlatforms.length === 0) {
    throw new Error("At least one platform name is required.");
  }

  // Validate each new platform name
  newPlatforms.forEach(validatePlatformName);

  // Fetch existing platforms data
  const platformsData = JSON.parse(await fetchS3File(PLATFORMS_FILE));

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