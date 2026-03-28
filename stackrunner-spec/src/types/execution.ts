import type { ApprovalResult } from "./approval.js";
import type { Artifact } from "./artifact.js";
import type { Checkpoint } from "./checkpoint.js";
import type { IsoDateTime } from "./common.js";
import type { Runbook } from "./runbook.js";
import type { VerificationResult } from "./verification.js";
import type { ExecutionState, StepState } from "../state-machine/index.js";

export interface ExecutionStepRecord {
  step_id: string;
  capability: string;
  provider: string;
  status: StepState;
  attempts: number;
  outputs?: Record<string, unknown>;
  approval?: ApprovalResult;
  verification?: VerificationResult;
  artifacts?: Artifact[];
  error?: string;
  started_at?: IsoDateTime;
  completed_at?: IsoDateTime;
}

export interface Execution {
  id: string;
  runbook: Runbook;
  status: ExecutionState;
  inputs: Record<string, unknown>;
  steps: ExecutionStepRecord[];
  artifacts: Artifact[];
  approvals: ApprovalResult[];
  checkpoints: Checkpoint[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}
