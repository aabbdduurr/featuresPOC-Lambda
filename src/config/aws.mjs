import { S3Client } from "@aws-sdk/client-s3";
import Ajv from "ajv";

// AWS S3 Client
export const s3Client = new S3Client({ region: "ap-south-1" });

// JSON Schema validator
export const ajv = new Ajv({ allErrors: true });