import type { IsoDateTime, RiskLevel } from "./common.js";
import type { AgentIdentity } from "./identity.js";

export type PolicyEffect = "allow" | "deny" | "require_approval";
export type PolicyOperator = "equals" | "in" | "includes" | "exists" | "gte" | "lte";

export interface PolicyPredicate {
  field: string;
  operator: PolicyOperator;
  value?: unknown;
}

export interface PolicyRule {
  id: string;
  effect: PolicyEffect;
  reason: string;
  description?: string;
  match: PolicyPredicate[];
}

export interface PolicySet {
  version: number;
  name: string;
  rules: PolicyRule[];
  default_effect?: PolicyEffect;
}

export interface PolicyContext {
  execution_id: string;
  runbook: string;
  step_id: string;
  capability: string;
  provider: string;
  category: string;
  risk_level: RiskLevel;
  actor: AgentIdentity;
  approval_policy?: string;
  mode?: string;
  delegated?: boolean;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  reason: string;
  actor_id: string;
  evaluated_at: IsoDateTime;
  matched: boolean;
  policy_id?: string;
}
