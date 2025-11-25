import { LOG_LIMIT, LOGS_PATH } from "../config/constants.mjs";
import { fetchS3File, writeS3File } from "../utils/s3.mjs";

// Helper function to create a simple log entry
export const createLogEntry = (user, action, details = {}) => {
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

export const appendLogToS3 = async (filePath, logEntry) => {
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
export const logGroupAction = async (platform, group, user, action) => {
  const logEntry = createLogEntry(user, action); // No need for extra details
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}.json`; // File structure includes platform/group
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for feature actions (creation/deletion)
export const logFeatureAction = async (platform, group, feature, user, action) => {
  const logEntry = createLogEntry(user, action); // Simple log
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // File structure includes platform/group/feature
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for feature value change, including segments and rollout (if any)
export const logFeatureValueChange = async (
  platform,
  group,
  feature,
  user,
  action,
  segment = null,
  value,
  rollout = null,
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
export const logSegmentDeletion = async (
  platform,
  group,
  feature,
  user,
  action,
  segment,
) => {
  const logEntry = createLogEntry(user, action, {
    segment, // Include segment details
  });
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // Log file for the feature
  await appendLogToS3(logFilePath, logEntry);
};

// Logging for segment reorder
export const logSegmentReorder = async (
  platform,
  group,
  feature,
  user,
  action,
  order,
) => {
  const logEntry = createLogEntry(user, action, {
    order, // Include order
  });
  const logFilePath = `${LOGS_PATH}${platform}/${group.id}/${feature.id}.json`; // Log file for the feature
  await appendLogToS3(logFilePath, logEntry);
};