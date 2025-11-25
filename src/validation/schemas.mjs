import { VALID_TYPES } from "../config/constants.mjs";

// Validation schemas
export const segmentSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    values: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["name", "description", "values"],
};

// Schema for segment update (only description is required)
export const segmentUpdateSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
  },
  required: ["name", "description"],
};

export const groupSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    features: { type: "array" },
  },
  required: ["id", "description"],
};

export const featureSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    type: { type: "string", enum: VALID_TYPES },
    value: {},
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          combo: { type: "object" }, // As object now, not a string
          value: {},
          rollout: {
            // New rollout property
            type: "object",
            properties: {
              percentage: { type: "number", minimum: 0, maximum: 100 },
              secondaryValue: {},
            },
            required: ["percentage", "secondaryValue"],
          },
        },
        required: ["combo", "value"],
      },
    },
    rollout: {
      // Main level rollout if no segments
      type: "object",
      properties: {
        percentage: { type: "number", minimum: 0, maximum: 100 },
        secondaryValue: {},
      },
      required: ["percentage", "secondaryValue"],
    },
  },
  required: ["id", "description", "type", "value"],
};