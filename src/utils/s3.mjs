import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws.mjs";
import { BUCKET, PLATFORMS_FILE, SEGMENTS_FILE, PLATFORM_PATH } from "../config/constants.mjs";

// Helper to construct platform file path
export const getPlatformFilePath = (platform) => `${PLATFORM_PATH}${platform}.json`;

// Convert stream to string (for S3 object reads)
export const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });

// Fetch files from S3, with appropriate default structures for platforms and segments
export const fetchS3File = async (key) => {
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
export const writeS3File = async (key, body) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(body),
    ContentType: "application/json",
    CacheControl: "no-cache, no-store, must-revalidate",
    Expires: new Date(0), // Set to epoch time (Jan 1, 1970)
    Metadata: {
      "last-modified": new Date().toISOString()
    }
  };
  await s3Client.send(new PutObjectCommand(params));
};