import { CAPABILITY_NAME_PATTERN } from "../types/common.js";
import type { JsonSchema } from "../types/json-schema.js";

export const isoDateTimeSchema: JsonSchema = {
  type: "string",
  format: "date-time"
};

export const capabilityNameSchema: JsonSchema = {
  type: "string",
  pattern: CAPABILITY_NAME_PATTERN
};

export const fieldDefinitionSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "type"],
  properties: {
    name: { type: "string" },
    type: {
      type: "string",
      enum: ["string", "number", "integer", "boolean", "object", "array", "unknown"]
    },
    description: { type: "string" },
    required: { type: "boolean" },
    schema: {
      type: "object",
      additionalProperties: true
    }
  }
};

export const conditionClauseSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["field", "condition"],
  properties: {
    field: { type: "string" },
    condition: { type: "string" },
    value: {},
    description: { type: "string" }
  }
};

export const timeoutPolicySchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["seconds"],
  properties: {
    seconds: { type: "integer", minimum: 1 }
  }
};

export const retryPolicySchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["max_attempts", "strategy", "delay_seconds"],
  properties: {
    max_attempts: { type: "integer", minimum: 1 },
    strategy: {
      type: "string",
      enum: ["fixed", "exponential"]
    },
    delay_seconds: { type: "integer", minimum: 0 },
    max_delay_seconds: { type: "integer", minimum: 0 },
    retry_on: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export const artifactDescriptorSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: { type: "string" },
    description: { type: "string" }
  }
};

export const rollbackDefinitionSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["strategy"],
  properties: {
    strategy: {
      type: "string",
      enum: ["manual", "compensating", "reversible"]
    },
    capability: capabilityNameSchema,
    description: { type: "string" }
  }
};

export const approvalSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["required", "policy", "reason"],
  properties: {
    required: { type: "boolean" },
    policy: { type: "string" },
    reason: { type: "string" }
  }
};

export const approvalResultSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: {
      type: "string",
      enum: ["requested", "approved", "rejected", "expired"]
    },
    actor: { type: "string" },
    timestamp: isoDateTimeSchema,
    note: { type: "string" }
  }
};

export const verificationContractSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "checks"],
  properties: {
    type: {
      type: "string",
      enum: ["provider_read", "http_check", "resource_diff", "artifact_check", "custom"]
    },
    checks: {
      type: "array",
      minItems: 1,
      items: conditionClauseSchema
    },
    description: { type: "string" },
    artifacts_emitted: {
      type: "array",
      items: artifactDescriptorSchema
    }
  }
};

export const verificationProofSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: { type: "string" },
    uri: { type: "string" },
    value: {},
    metadata: {
      type: "object",
      additionalProperties: true
    }
  }
};

export const verificationResultSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "observed_state", "proof", "confidence", "verifier", "checked_at"],
  properties: {
    status: {
      type: "string",
      enum: ["passed", "failed", "inconclusive"]
    },
    observed_state: {
      type: "object",
      additionalProperties: true
    },
    proof: {
      type: "array",
      items: verificationProofSchema
    },
    confidence: { type: "number", minimum: 0 },
    verifier: {
      type: "string",
      enum: ["provider_read", "http_check", "resource_diff", "artifact_check", "custom"]
    },
    checked_at: isoDateTimeSchema
  }
};

export const artifactSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "step_id", "type", "uri", "metadata"],
  properties: {
    id: { type: "string" },
    step_id: { type: "string" },
    type: { type: "string" },
    uri: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: true
    }
  }
};

export const checkpointPolicySchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["enabled"],
  properties: {
    enabled: { type: "boolean" },
    resumable_from: { type: "string" },
    include_outputs: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export const checkpointSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "execution_id",
    "after_step",
    "verified_outputs",
    "resumable_from",
    "timestamp"
  ],
  properties: {
    id: { type: "string" },
    execution_id: { type: "string" },
    after_step: { type: "string" },
    verified_outputs: {
      type: "object",
      additionalProperties: true
    },
    resumable_from: { type: "string" },
    timestamp: isoDateTimeSchema
  }
};
