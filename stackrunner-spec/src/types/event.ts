import type { IsoDateTime } from "./common.js";

export type StackRunnerEventType =
  | "execution.created"
  | "execution.planned"
  | "execution.running"
  | "execution.blocked"
  | "execution.failed"
  | "execution.completed"
  | "execution.rolled_back"
  | "step.ready"
  | "step.awaiting_approval"
  | "step.running"
  | "step.verifying"
  | "step.verified"
  | "step.failed"
  | "step.rolled_back"
  | "policy.evaluated"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "adapter.execute.started"
  | "adapter.execute.completed"
  | "verification.completed"
  | "checkpoint.created"
  | "rollback.started"
  | "rollback.completed"
  | "rollback.failed";

export interface ExecutionEvent {
  id: string;
  execution_id: string;
  sequence: number;
  type: StackRunnerEventType;
  timestamp: IsoDateTime;
  step_id?: string;
  actor_id?: string;
  data: Record<string, unknown>;
}
