export const EXECUTION_STATES = [
  "created",
  "planned",
  "running",
  "blocked",
  "failed",
  "completed",
  "rolled_back",
  "cancelled"
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const EXECUTION_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  created: ["planned", "cancelled"],
  planned: ["running", "blocked", "cancelled"],
  running: ["blocked", "failed", "completed", "rolled_back", "cancelled"],
  blocked: ["planned", "running", "failed", "cancelled"],
  failed: ["rolled_back", "cancelled"],
  completed: [],
  rolled_back: [],
  cancelled: []
};

export function canTransitionExecution(
  from: ExecutionState,
  to: ExecutionState
): boolean {
  return EXECUTION_TRANSITIONS[from].includes(to);
}
