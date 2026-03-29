import type { AgentIdentity } from "./identity.js";

export type EvalAssertionKind =
  | "execution_status"
  | "step_status"
  | "event_type"
  | "policy_effect";

export interface EvalAssertion {
  kind: EvalAssertionKind;
  expected: string;
  target?: string;
}

export interface EvalScenario {
  id: string;
  description: string;
  runbook: string;
  inputs: Record<string, unknown>;
  actor: AgentIdentity;
  mode?: "mock" | "hybrid" | "real";
  auto_approve?: boolean;
  expected_outcome: string;
  assertions: EvalAssertion[];
}
