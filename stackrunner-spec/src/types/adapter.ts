import type { Artifact } from "./artifact.js";
import type { Capability } from "./capability.js";
import type { Checkpoint } from "./checkpoint.js";
import type { CapabilityCategory, CapabilityName } from "./common.js";
import type { Execution } from "./execution.js";
import type { AgentIdentity } from "./identity.js";
import type { Runbook, RunbookStep } from "./runbook.js";
import type { VerificationResult } from "./verification.js";

export interface AdapterConfig {
  provider: string;
  credentials?: Record<string, string>;
  defaults?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface CapabilityDescriptor {
  capability: CapabilityName;
  version: number;
  provider: string;
  category: CapabilityCategory;
}

export interface ExecutionResult {
  status: "succeeded" | "failed";
  outputs: Record<string, unknown>;
  artifacts?: Artifact[];
  provider_response?: unknown;
  error?: string;
}

export interface RollbackResult {
  status: "rolled_back" | "failed" | "not_supported";
  artifacts?: Artifact[];
  error?: string;
}

export interface StepContext {
  execution: Pick<Execution, "id" | "status" | "inputs" | "artifacts" | "checkpoints" | "events">;
  runbook: Runbook;
  step: RunbookStep;
  capability: Capability;
  actor?: AgentIdentity;
  attempt: number;
  resolved_input: Record<string, unknown>;
  prior_artifacts: Artifact[];
  checkpoints: Checkpoint[];
}

export interface Adapter {
  name: string;
  supports(): CapabilityDescriptor[];
  validate(config: AdapterConfig): Promise<ValidationResult>;
  execute(step: StepContext): Promise<ExecutionResult>;
  verify(step: StepContext, result: ExecutionResult): Promise<VerificationResult>;
  rollback?(step: StepContext, result: ExecutionResult): Promise<RollbackResult>;
}
