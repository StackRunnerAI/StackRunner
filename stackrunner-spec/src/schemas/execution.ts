import type { JsonSchema } from "../types/json-schema.js";
import { EXECUTION_STATES, STEP_STATES } from "../state-machine/index.js";
import {
  approvalResultSchema,
  artifactSchema,
  checkpointSchema,
  isoDateTimeSchema,
  verificationResultSchema
} from "./shared.js";

export const executionStepRecordSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["step_id", "capability", "provider", "status", "attempts"],
  properties: {
    step_id: { type: "string" },
    capability: { type: "string" },
    provider: { type: "string" },
    status: {
      type: "string",
      enum: [...STEP_STATES]
    },
    attempts: { type: "integer", minimum: 0 },
    outputs: {
      type: "object",
      additionalProperties: true
    },
    approval: approvalResultSchema,
    verification: verificationResultSchema,
    artifacts: {
      type: "array",
      items: artifactSchema
    },
    error: { type: "string" },
    started_at: isoDateTimeSchema,
    completed_at: isoDateTimeSchema
  }
};

export const executionSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://stackrunner.dev/schema/execution.json",
  title: "StackRunner Execution",
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "runbook",
    "status",
    "inputs",
    "steps",
    "artifacts",
    "approvals",
    "checkpoints",
    "created_at",
    "updated_at"
  ],
  properties: {
    id: { type: "string" },
    runbook: {
      type: "object",
      additionalProperties: true
    },
    status: {
      type: "string",
      enum: [...EXECUTION_STATES]
    },
    inputs: {
      type: "object",
      additionalProperties: true
    },
    steps: {
      type: "array",
      items: executionStepRecordSchema
    },
    artifacts: {
      type: "array",
      items: artifactSchema
    },
    approvals: {
      type: "array",
      items: approvalResultSchema
    },
    checkpoints: {
      type: "array",
      items: checkpointSchema
    },
    created_at: isoDateTimeSchema,
    updated_at: isoDateTimeSchema
  }
};
