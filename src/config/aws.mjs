import { S3Client } from "@aws-sdk/client-s3";
import Ajv from "ajv";
import { AWS_REGION } from "./constants.mjs";

// AWS S3 Client
export const s3Client = new S3Client({ region: AWS_REGION });

// JSON Schema validator
export const ajv = new Ajv({ allErrors: true });