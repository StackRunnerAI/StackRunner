import type { IsoDateTime } from "./common.js";

export interface Checkpoint {
  id: string;
  execution_id: string;
  after_step: string;
  verified_outputs: Record<string, unknown>;
  resumable_from: string;
  timestamp: IsoDateTime;
}

export interface CheckpointPolicy {
  enabled: boolean;
  resumable_from?: string;
  include_outputs?: string[];
}
