export const STEP_STATES = [
  "pending",
  "ready",
  "running",
  "awaiting_approval",
  "verifying",
  "verified",
  "failed",
  "blocked",
  "rolled_back",
  "skipped"
] as const;

export type StepState = (typeof STEP_STATES)[number];

export const STEP_TRANSITIONS: Record<StepState, StepState[]> = {
  pending: ["ready", "skipped"],
  ready: ["running", "awaiting_approval", "blocked", "skipped"],
  running: ["verifying", "failed", "blocked"],
  awaiting_approval: ["ready", "failed", "blocked", "skipped"],
  verifying: ["verified", "failed", "blocked"],
  verified: [],
  failed: ["rolled_back", "skipped"],
  blocked: ["ready", "running", "failed", "skipped"],
  rolled_back: [],
  skipped: []
};

export function canTransitionStep(from: StepState, to: StepState): boolean {
  return STEP_TRANSITIONS[from].includes(to);
}
