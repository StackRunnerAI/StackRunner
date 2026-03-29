import type { CapabilityName, IsoDateTime } from "./common.js";

export type CompensationStrategy = "adapter_rollback" | "capability" | "manual";
export type RollbackStatus = "not_needed" | "pending" | "running" | "rolled_back" | "failed";

export interface CompensationDefinition {
  strategy: CompensationStrategy;
  capability?: CapabilityName;
  with?: Record<string, unknown>;
  description?: string;
}

export interface RollbackRecord {
  status: RollbackStatus;
  strategy?: CompensationStrategy;
  attempted_at?: IsoDateTime;
  completed_at?: IsoDateTime;
  error?: string;
}
