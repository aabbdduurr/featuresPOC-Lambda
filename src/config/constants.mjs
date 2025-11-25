// Application constants
export const VALID_TYPES = ["boolean", "number", "string"];
export const LOG_LIMIT = 100;

// AWS S3 Configuration
// Values are loaded from environment variables (set from config.env)
// This creates a single source of truth for configuration
// Note: AWS_REGION is reserved by Lambda, so we use CUSTOM_AWS_REGION with fallbacks
export const AWS_REGION = process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "ap-south-1";
export const BUCKET = process.env.BUCKET_NAME || "feature-toggle-bucket-abdur-1764071798";
export const PLATFORMS_FILE = "platforms.json";
export const SEGMENTS_FILE = "segments.json";
export const PLATFORM_PATH = "platforms/";
export const LOGS_PATH = "logs/";

// JWT Configuration  
// Loaded from environment variable (set from config.env)
export const JWT_SECRET = process.env.JWT_SECRET || "togglePOC";