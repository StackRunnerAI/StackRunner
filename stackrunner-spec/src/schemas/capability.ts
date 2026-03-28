import type { JsonSchema } from "../types/json-schema.js";
import {
  approvalSchema,
  artifactDescriptorSchema,
  capabilityNameSchema,
  conditionClauseSchema,
  fieldDefinitionSchema,
  retryPolicySchema,
  rollbackDefinitionSchema,
  timeoutPolicySchema,
  verificationContractSchema
} from "./shared.js";

export const capabilitySchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://stackrunner.dev/schema/capability.json",
  title: "StackRunner Capability",
  type: "object",
  additionalProperties: false,
  required: [
    "capability",
    "version",
    "provider",
    "category",
    "risk_level",
    "inputs",
    "outputs",
    "verifier",
    "idempotency"
  ],
  properties: {
    capability: capabilityNameSchema,
    version: { type: "integer", minimum: 1 },
    provider: { type: "string" },
    category: { type: "string" },
    risk_level: {
      type: "string",
      enum: ["low", "medium", "high", "critical"]
    },
    inputs: {
      type: "array",
      items: fieldDefinitionSchema
    },
    outputs: {
      type: "array",
      items: fieldDefinitionSchema
    },
    verifier: verificationContractSchema,
    idempotency: {
      type: "object",
      additionalProperties: false,
      required: ["key_template"],
      properties: {
        key_template: { type: "string" },
        scope: {
          type: "string",
          enum: ["step", "execution", "provider"]
        }
      }
    },
    rollback: rollbackDefinitionSchema,
    approval: approvalSchema,
    timeout: timeoutPolicySchema,
    retry_policy: retryPolicySchema,
    preconditions: {
      type: "array",
      items: conditionClauseSchema
    },
    postconditions: {
      type: "array",
      items: conditionClauseSchema
    },
    artifacts_emitted: {
      type: "array",
      items: artifactDescriptorSchema
    }
  }
};
