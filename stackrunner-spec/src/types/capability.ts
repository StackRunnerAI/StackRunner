import type {
  ArtifactDescriptor,
  CapabilityCategory,
  CapabilityName,
  ConditionClause,
  FieldDefinition,
  IdempotencyPolicy,
  RetryPolicy,
  RiskLevel,
  RollbackDefinition,
  TimeoutPolicy
} from "./common.js";
import type { Approval } from "./approval.js";
import type { VerificationContract } from "./verification.js";

export interface Capability {
  capability: CapabilityName;
  version: number;
  provider: string;
  category: CapabilityCategory;
  risk_level: RiskLevel;
  inputs: FieldDefinition[];
  outputs: FieldDefinition[];
  verifier: VerificationContract;
  idempotency: IdempotencyPolicy;
  rollback?: RollbackDefinition;
  approval?: Approval;
  timeout?: TimeoutPolicy;
  retry_policy?: RetryPolicy;
  preconditions?: ConditionClause[];
  postconditions?: ConditionClause[];
  artifacts_emitted?: ArtifactDescriptor[];
}
