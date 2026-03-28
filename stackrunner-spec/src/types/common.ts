export type IsoDateTime = string;
export type LooseString = string & {};
export type CapabilityName = `${string}.${string}_${string}`;

export type CapabilityCategory =
  | "auth"
  | "database"
  | "billing"
  | "email"
  | "deploy"
  | "dns"
  | "verify"
  | "secrets"
  | LooseString;

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ValueType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "unknown";

export const CAPABILITY_NAME_PATTERN =
  "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\.[a-z][a-z0-9]*_[a-z][a-z0-9_]*$";

export interface FieldDefinition {
  name: string;
  type: ValueType;
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
}

export interface TimeoutPolicy {
  seconds: number;
}

export interface RetryPolicy {
  max_attempts: number;
  strategy: "fixed" | "exponential";
  delay_seconds: number;
  max_delay_seconds?: number;
  retry_on?: string[];
}

export interface ConditionClause {
  field: string;
  condition: string;
  value?: unknown;
  description?: string;
}

export interface IdempotencyPolicy {
  key_template: string;
  scope?: "step" | "execution" | "provider";
}

export interface RollbackDefinition {
  strategy: "manual" | "compensating" | "reversible";
  capability?: CapabilityName;
  description?: string;
}

export interface ArtifactDescriptor {
  type: string;
  description?: string;
}
