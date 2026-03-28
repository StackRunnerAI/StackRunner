import type { JsonSchema } from "../types/json-schema.js";
import {
  approvalSchema,
  artifactDescriptorSchema,
  capabilityNameSchema,
  checkpointPolicySchema,
  fieldDefinitionSchema,
  retryPolicySchema,
  timeoutPolicySchema
} from "./shared.js";

export const runbookStepSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "capability", "provider", "with", "depends_on"],
  properties: {
    id: { type: "string" },
    capability: capabilityNameSchema,
    provider: { type: "string" },
    with: {
      type: "object",
      additionalProperties: true
    },
    depends_on: {
      type: "array",
      items: { type: "string" }
    },
    approval: approvalSchema,
    retry_policy: retryPolicySchema,
    timeout: timeoutPolicySchema,
    on_failure: {
      type: "string",
      enum: ["halt", "rollback", "continue"]
    },
    emit_artifacts: {
      type: "array",
      items: artifactDescriptorSchema
    },
    checkpoint: checkpointPolicySchema
  }
};

export const runbookSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://stackrunner.dev/schema/runbook.json",
  title: "StackRunner Runbook",
  type: "object",
  additionalProperties: false,
  required: ["version", "runbook", "description", "inputs", "steps"],
  properties: {
    version: { type: "integer", minimum: 1 },
    runbook: { type: "string" },
    description: { type: "string" },
    inputs: {
      type: "array",
      items: fieldDefinitionSchema
    },
    steps: {
      type: "array",
      minItems: 1,
      items: runbookStepSchema
    }
  }
};
