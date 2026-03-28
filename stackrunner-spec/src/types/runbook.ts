import type { Approval } from "./approval.js";
import type { CheckpointPolicy } from "./checkpoint.js";
import type {
  ArtifactDescriptor,
  CapabilityName,
  FieldDefinition,
  RetryPolicy,
  TimeoutPolicy
} from "./common.js";

export type StepFailureStrategy = "halt" | "rollback" | "continue";

export interface RunbookStep {
  id: string;
  capability: CapabilityName;
  provider: string;
  with: Record<string, unknown>;
  depends_on: string[];
  approval?: Approval;
  retry_policy?: RetryPolicy;
  timeout?: TimeoutPolicy;
  on_failure?: StepFailureStrategy;
  emit_artifacts?: ArtifactDescriptor[];
  checkpoint?: CheckpointPolicy;
}

export interface Runbook {
  version: number;
  runbook: string;
  description: string;
  inputs: FieldDefinition[];
  steps: RunbookStep[];
}
