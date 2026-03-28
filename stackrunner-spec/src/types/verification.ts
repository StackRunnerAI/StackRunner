import type { ArtifactDescriptor, ConditionClause, IsoDateTime } from "./common.js";

export type VerifierType =
  | "provider_read"
  | "http_check"
  | "resource_diff"
  | "artifact_check"
  | "custom";

export interface VerificationContract {
  type: VerifierType;
  checks: ConditionClause[];
  description?: string;
  artifacts_emitted?: ArtifactDescriptor[];
}

export type VerificationStatus = "passed" | "failed" | "inconclusive";

export interface VerificationProof {
  type: string;
  uri?: string;
  value?: unknown;
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  status: VerificationStatus;
  observed_state: Record<string, unknown>;
  proof: VerificationProof[];
  confidence: number;
  verifier: VerifierType;
  checked_at: IsoDateTime;
}
