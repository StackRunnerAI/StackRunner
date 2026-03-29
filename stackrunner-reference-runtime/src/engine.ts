import type {
  Adapter,
  AgentIdentity,
  ApprovalResult,
  Artifact,
  Capability,
  Checkpoint,
  EvalAssertion,
  EvalScenario,
  Execution,
  ExecutionEvent,
  ExecutionResult,
  ExecutionState,
  ExecutionStepRecord,
  PolicyDecision,
  RollbackRecord,
  Runbook,
  RunbookStep,
  StepContext,
  StepState,
  VerificationResult
} from "stackrunner-spec";
import {
  canTransitionExecution,
  canTransitionStep,
  exampleCapabilities
} from "stackrunner-spec";
import { createAdapters, type ExecutionMode } from "./adapter-registry.js";
import { evalScenarios } from "./eval-scenarios.js";
import { FileExecutionStore, type StoredExecutionRecord, type StoredExecutionSummary } from "./execution-store.js";
import { resolveIdentity } from "./identities.js";
import { evaluatePolicy, type PolicyEvaluationResult } from "./policy-engine.js";
import { getRuntimeRunbooks } from "./runtime-runbooks.js";
import { resolveTemplate } from "./template.js";
import { createExecutionId, deepClone, formatTimestamp } from "./utils.js";

export interface RunOptions {
  runbook: string;
  inputs?: Record<string, unknown>;
  autoApprove?: boolean;
  mode?: ExecutionMode;
  actor?: AgentIdentity | string;
}

export interface RunResult {
  execution: Execution;
  approvals_required: ApprovalResult[];
  file: string;
}

export interface ApprovalActionOptions {
  actor?: string;
  note?: string;
}

export interface EvalAssertionResult {
  assertion: EvalAssertion;
  passed: boolean;
  actual: unknown;
}

export interface EvalScenarioResult {
  scenario: EvalScenario;
  result: RunResult;
  passed: boolean;
  assertions: EvalAssertionResult[];
}

const capabilityMap = new Map(exampleCapabilities.map((capability) => [capability.capability, capability]));
const runbookMap = new Map(getRuntimeRunbooks().map((runbook) => [runbook.runbook, runbook]));
const evalScenarioMap = new Map(evalScenarios.map((scenario) => [scenario.id, scenario]));

function assertExecutionTransition(from: ExecutionState, to: ExecutionState): ExecutionState {
  if (!canTransitionExecution(from, to)) {
    throw new Error(`Invalid execution transition: ${from} -> ${to}`);
  }

  return to;
}

function assertStepTransition(from: StepState, to: StepState): StepState {
  if (!canTransitionStep(from, to)) {
    throw new Error(`Invalid step transition: ${from} -> ${to}`);
  }

  return to;
}

function createExecutionStepRecord(step: RunbookStep): ExecutionStepRecord {
  return {
    step_id: step.id,
    capability: step.capability,
    provider: step.provider,
    status: "pending",
    attempts: 0
  };
}

function getCapability(step: RunbookStep): Capability {
  const capability = capabilityMap.get(step.capability);

  if (!capability) {
    throw new Error(`Missing capability definition for ${step.capability}`);
  }

  return capability;
}

function getRunbook(name: string): Runbook {
  const runbook = runbookMap.get(name);
  if (!runbook) {
    throw new Error(`Unknown runbook: ${name}`);
  }

  return deepClone(runbook);
}

function getEvalScenario(id: string): EvalScenario {
  const scenario = evalScenarioMap.get(id);
  if (!scenario) {
    throw new Error(`Unknown eval scenario: ${id}`);
  }

  return deepClone(scenario);
}

function buildResolutionContext(
  execution: Execution,
  stepOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  return {
    execution: {
      id: execution.id,
      status: execution.status,
      actor_id: execution.actor?.id
    },
    inputs: execution.inputs,
    steps: Object.fromEntries(
      execution.runbook.steps.map((step) => [
        step.id,
        {
          outputs: stepOutputs.get(step.id) ?? {}
        }
      ])
    )
  };
}

function now(): string {
  return formatTimestamp(new Date());
}

function createCheckpoint(
  execution: Execution,
  step: RunbookStep,
  outputs: Record<string, unknown>
): Checkpoint {
  const included = step.checkpoint?.include_outputs;
  const verified_outputs = included
    ? Object.fromEntries(
        included
          .filter((key) => key in outputs)
          .map((key) => [key, outputs[key]])
      )
    : outputs;

  return {
    id: `checkpoint_${execution.id}_${step.id}`,
    execution_id: execution.id,
    after_step: step.id,
    verified_outputs,
    resumable_from: step.checkpoint?.resumable_from ?? step.id,
    timestamp: now()
  };
}

function syncApprovals(execution: Execution): void {
  execution.approvals = execution.steps
    .map((step) => step.approval)
    .filter((approval): approval is ApprovalResult => Boolean(approval));
}

function createVerificationArtifact(
  execution: Execution,
  record: ExecutionStepRecord
): Artifact | undefined {
  if (!record.verification) {
    return undefined;
  }

  return {
    id: `artifact_${execution.id}_${record.step_id}_verification`,
    step_id: record.step_id,
    type: "verification_proof",
    uri: `memory://${execution.id}/${record.step_id}/verification-proof`,
    metadata: {
      verifier: record.verification.verifier,
      confidence: record.verification.confidence,
      proof: record.verification.proof
    }
  };
}

function normalizeExecution(execution: Execution): void {
  execution.artifacts ??= [];
  execution.approvals ??= [];
  execution.checkpoints ??= [];
  execution.policy_decisions ??= [];
  execution.events ??= [];

  for (const step of execution.steps) {
    step.artifacts ??= [];
  }
}

function stepNeedsDeclaredApproval(step: RunbookStep, capability: Capability): boolean {
  return Boolean(step.approval?.required || capability.approval?.required);
}

function resolveActor(actor?: AgentIdentity | string): AgentIdentity {
  if (!actor) {
    return resolveIdentity("root-agent");
  }

  if (typeof actor === "string") {
    return resolveIdentity(actor);
  }

  return deepClone(actor);
}

function getReadySteps(execution: Execution): RunbookStep[] {
  const records = new Map(execution.steps.map((record) => [record.step_id, record]));

  return execution.runbook.steps.filter((step) =>
    step.depends_on.every((dependency) => records.get(dependency)?.status === "verified") &&
    (records.get(step.id)?.status === "pending" || records.get(step.id)?.status === "ready")
  );
}

function getPendingApprovalSteps(execution: Execution): ExecutionStepRecord[] {
  return execution.steps.filter(
    (step) => step.status === "awaiting_approval" && step.approval?.status === "requested"
  );
}

function getStepRecord(execution: Execution, stepId: string): ExecutionStepRecord {
  const stepRecord = execution.steps.find((item) => item.step_id === stepId);
  if (!stepRecord) {
    throw new Error(`Missing execution step record for ${stepId}`);
  }

  return stepRecord;
}

function createEvent(
  execution: Execution,
  type: ExecutionEvent["type"],
  data: Record<string, unknown>,
  stepId?: string,
  actorId?: string
): ExecutionEvent {
  const sequence = execution.events.length + 1;
  return {
    id: `evt_${execution.id}_${sequence}`,
    execution_id: execution.id,
    sequence,
    type,
    timestamp: now(),
    ...(stepId ? { step_id: stepId } : {}),
    ...(actorId ? { actor_id: actorId } : {}),
    data
  };
}

function emitEvent(
  execution: Execution,
  type: ExecutionEvent["type"],
  data: Record<string, unknown>,
  stepId?: string,
  actorId?: string
): void {
  execution.events.push(createEvent(execution, type, data, stepId, actorId));
  execution.updated_at = now();
}

function executionEventType(state: ExecutionState): ExecutionEvent["type"] | undefined {
  switch (state) {
    case "created":
      return "execution.created";
    case "planned":
      return "execution.planned";
    case "running":
      return "execution.running";
    case "blocked":
      return "execution.blocked";
    case "failed":
      return "execution.failed";
    case "completed":
      return "execution.completed";
    case "rolled_back":
      return "execution.rolled_back";
    default:
      return undefined;
  }
}

function stepEventType(state: StepState): ExecutionEvent["type"] | undefined {
  switch (state) {
    case "ready":
      return "step.ready";
    case "awaiting_approval":
      return "step.awaiting_approval";
    case "running":
      return "step.running";
    case "verifying":
      return "step.verifying";
    case "verified":
      return "step.verified";
    case "failed":
      return "step.failed";
    case "rolled_back":
      return "step.rolled_back";
    default:
      return undefined;
  }
}

function transitionExecution(
  execution: Execution,
  to: ExecutionState,
  data: Record<string, unknown> = {},
  actorId?: string
): void {
  if (execution.status === to) {
    return;
  }

  const from = execution.status;
  execution.status = assertExecutionTransition(from, to);
  const eventType = executionEventType(to);
  if (eventType) {
    emitEvent(execution, eventType, { from, to, ...data }, undefined, actorId);
  }
}

function transitionStep(
  execution: Execution,
  record: ExecutionStepRecord,
  to: StepState,
  data: Record<string, unknown> = {},
  actorId?: string
): void {
  if (record.status === to) {
    return;
  }

  const from = record.status;
  record.status = assertStepTransition(from, to);
  const eventType = stepEventType(to);
  if (eventType) {
    emitEvent(execution, eventType, { from, to, ...data }, record.step_id, actorId);
  }
}

function buildExecutionView(execution: Execution): StepContext["execution"] {
  return {
    id: execution.id,
    status: execution.status,
    inputs: execution.inputs,
    artifacts: execution.artifacts,
    checkpoints: execution.checkpoints,
    events: execution.events
  };
}

function buildStepContext(
  execution: Execution,
  actor: AgentIdentity,
  step: RunbookStep,
  capability: Capability,
  stepRecord: ExecutionStepRecord,
  resolved_input: Record<string, unknown>
): StepContext {
  return {
    execution: buildExecutionView(execution),
    runbook: execution.runbook,
    step,
    capability,
    actor,
    attempt: stepRecord.attempts,
    resolved_input,
    prior_artifacts: execution.artifacts.filter((artifact) => artifact.step_id !== step.id),
    checkpoints: execution.checkpoints
  };
}

function createApprovalResult(
  step: RunbookStep,
  capability: Capability,
  approved: boolean,
  actor: string,
  policyDecision?: PolicyDecision
): ApprovalResult {
  const policy = step.approval?.policy ?? capability.approval?.policy ?? policyDecision?.policy_id ?? "policy_gate";
  const reason = step.approval?.reason ?? capability.approval?.reason ?? policyDecision?.reason ?? "Approval required";

  return {
    status: approved ? "approved" : "requested",
    ...(approved ? { actor } : {}),
    timestamp: now(),
    note: `${policy}: ${reason}`
  };
}

function finalPolicyDecision(decisions: PolicyDecision[], actor: AgentIdentity): PolicyDecision {
  return (
    decisions.find((decision) => decision.effect === "deny") ??
    decisions.find((decision) => decision.effect === "require_approval") ??
    decisions[0] ?? {
      effect: "allow",
      reason: "No policy rule blocked the action.",
      actor_id: actor.id,
      evaluated_at: now(),
      matched: false
    }
  );
}

function resolveRollbackStrategy(step: RunbookStep, capability: Capability): RollbackRecord["strategy"] | undefined {
  if (step.compensation?.strategy) {
    return step.compensation.strategy;
  }

  switch (capability.rollback?.strategy) {
    case "manual":
      return "manual";
    case "compensating":
    case "reversible":
      return "adapter_rollback";
    default:
      return undefined;
  }
}

function hasTerminalExecutionState(execution: Execution): boolean {
  return execution.status === "completed" || execution.status === "failed" || execution.status === "rolled_back" || execution.status === "cancelled";
}

function allStepsTerminal(execution: Execution): boolean {
  return execution.steps.every((step) =>
    step.status === "verified" ||
    step.status === "failed" ||
    step.status === "rolled_back" ||
    step.status === "skipped"
  );
}

export class ReferenceRuntime {
  private readonly store: FileExecutionStore;

  constructor(store: FileExecutionStore = new FileExecutionStore()) {
    this.store = store;
  }

  listRunbooks(): Runbook[] {
    return getRuntimeRunbooks().map((runbook) => deepClone(runbook));
  }

  listEvalScenarios(): EvalScenario[] {
    return evalScenarios.map((scenario) => deepClone(scenario));
  }

  async runEvalScenario(id: string): Promise<EvalScenarioResult> {
    const scenario = getEvalScenario(id);
    const result = await this.run({
      runbook: scenario.runbook,
      inputs: scenario.inputs,
      ...(scenario.auto_approve === undefined ? {} : { autoApprove: scenario.auto_approve }),
      ...(scenario.mode === undefined ? {} : { mode: scenario.mode }),
      actor: scenario.actor
    });
    const assertions = scenario.assertions.map((assertion) => this.evaluateAssertion(result.execution, assertion));

    return {
      scenario,
      result,
      assertions,
      passed: assertions.every((assertion) => assertion.passed)
    };
  }

  async listExecutions(): Promise<StoredExecutionSummary[]> {
    return this.store.list();
  }

  async getExecution(executionId: string): Promise<StoredExecutionRecord> {
    const record = await this.store.load(executionId);
    normalizeExecution(record.execution);
    return record;
  }

  async approveExecution(executionId: string, options: ApprovalActionOptions = {}): Promise<StoredExecutionRecord> {
    const record = await this.store.load(executionId);
    normalizeExecution(record.execution);
    let changed = false;

    for (const stepRecord of record.execution.steps) {
      if (stepRecord.status !== "awaiting_approval" || stepRecord.approval?.status !== "requested") {
        continue;
      }

      stepRecord.approval = {
        ...stepRecord.approval,
        status: "approved",
        actor: options.actor ?? "manual",
        timestamp: now(),
        ...((options.note ?? stepRecord.approval.note)
          ? { note: options.note ?? stepRecord.approval.note }
          : {})
      };
      emitEvent(
        record.execution,
        "approval.approved",
        {
          approval: stepRecord.approval.note ?? "approved"
        },
        stepRecord.step_id,
        stepRecord.approval.actor
      );
      transitionStep(record.execution, stepRecord, "ready", {}, stepRecord.approval.actor);
      changed = true;
    }

    if (!changed) {
      return record;
    }

    if (record.execution.status === "blocked") {
      transitionExecution(record.execution, "planned", { reason: "Manual approval granted." }, options.actor ?? "manual");
    }

    await this.store.save(record);
    return record;
  }

  async rejectExecution(executionId: string, options: ApprovalActionOptions = {}): Promise<StoredExecutionRecord> {
    const record = await this.store.load(executionId);
    normalizeExecution(record.execution);
    let changed = false;

    for (const stepRecord of record.execution.steps) {
      if (stepRecord.status !== "awaiting_approval" || stepRecord.approval?.status !== "requested") {
        continue;
      }

      stepRecord.approval = {
        ...stepRecord.approval,
        status: "rejected",
        actor: options.actor ?? "manual",
        timestamp: now(),
        ...((options.note ?? stepRecord.approval.note)
          ? { note: options.note ?? stepRecord.approval.note }
          : {})
      };
      emitEvent(
        record.execution,
        "approval.rejected",
        {
          approval: stepRecord.approval.note ?? "rejected"
        },
        stepRecord.step_id,
        stepRecord.approval.actor
      );
      stepRecord.error = options.note ?? "Approval rejected";
      stepRecord.completed_at = now();
      transitionStep(record.execution, stepRecord, "failed", { error: stepRecord.error }, stepRecord.approval.actor);
      changed = true;
    }

    if (!changed) {
      return record;
    }

    if (record.execution.status === "blocked") {
      transitionExecution(record.execution, "failed", { reason: "Manual approval rejected." }, options.actor ?? "manual");
    }

    await this.store.save(record);
    return record;
  }

  async run(options: RunOptions): Promise<RunResult> {
    const runbook = getRunbook(options.runbook);
    const mode = options.mode ?? "mock";
    const actor = resolveActor(options.actor);
    const execution: Execution = {
      id: createExecutionId(runbook.runbook),
      runbook,
      status: "created",
      actor,
      inputs: options.inputs ?? {},
      steps: runbook.steps.map(createExecutionStepRecord),
      artifacts: [],
      approvals: [],
      checkpoints: [],
      policy_decisions: [],
      events: [],
      created_at: now(),
      updated_at: now()
    };
    emitEvent(execution, "execution.created", { to: "created" }, undefined, actor.id);

    const record: StoredExecutionRecord = {
      mode,
      execution
    };

    return this.execute(record, Boolean(options.autoApprove));
  }

  async resume(executionId: string, autoApprove = false): Promise<RunResult> {
    const record = await this.store.load(executionId);
    normalizeExecution(record.execution);
    return this.execute(record, autoApprove);
  }

  private evaluateAssertion(execution: Execution, assertion: EvalAssertion): EvalAssertionResult {
    switch (assertion.kind) {
      case "execution_status":
        return {
          assertion,
          passed: execution.status === assertion.expected,
          actual: execution.status
        };
      case "step_status": {
        const step = execution.steps.find((item) => item.step_id === assertion.target);
        return {
          assertion,
          passed: step?.status === assertion.expected,
          actual: step?.status ?? null
        };
      }
      case "event_type": {
        const actual = execution.events.some((event) => event.type === assertion.expected);
        return {
          assertion,
          passed: actual,
          actual
        };
      }
      case "policy_effect": {
        const step = execution.steps.find((item) => item.capability === assertion.target);
        const effect = step?.policy_decisions?.length
          ? finalPolicyDecision(step.policy_decisions, execution.actor ?? resolveIdentity("root-agent")).effect
          : null;

        return {
          assertion,
          passed: effect === assertion.expected,
          actual: effect
        };
      }
      default:
        return {
          assertion,
          passed: false,
          actual: null
        };
    }
  }

  private async persist(record: StoredExecutionRecord): Promise<string> {
    normalizeExecution(record.execution);
    syncApprovals(record.execution);
    return this.store.save(record);
  }

  private evaluateStepPolicy(
    stored: StoredExecutionRecord,
    step: RunbookStep,
    capability: Capability,
    stepRecord: ExecutionStepRecord
  ): PolicyEvaluationResult {
    const execution = stored.execution;
    const actor = execution.actor ?? resolveIdentity("root-agent");

    if (stepRecord.policy_decisions?.length) {
      return {
        decisions: stepRecord.policy_decisions,
        final: finalPolicyDecision(stepRecord.policy_decisions, actor)
      };
    }

    const approvalPolicy = step.approval?.policy ?? capability.approval?.policy;
    const evaluation = evaluatePolicy({
      execution_id: execution.id,
      runbook: execution.runbook.runbook,
      step_id: step.id,
      capability: capability.capability,
      provider: step.provider,
      category: capability.category,
      risk_level: capability.risk_level,
      actor,
      ...(approvalPolicy === undefined ? {} : { approval_policy: approvalPolicy }),
      mode: stored.mode,
      delegated: Boolean(actor.delegated_by)
    });

    stepRecord.policy_decisions = evaluation.decisions;
    execution.policy_decisions = [...(execution.policy_decisions ?? []), ...evaluation.decisions];
    emitEvent(
      execution,
      "policy.evaluated",
      {
        final_effect: evaluation.final.effect,
        decisions: evaluation.decisions.map((decision) => ({
          effect: decision.effect,
          reason: decision.reason,
          policy_id: decision.policy_id,
          matched: decision.matched
        }))
      },
      step.id,
      actor.id
    );

    return evaluation;
  }

  private async failStep(
    stored: StoredExecutionRecord,
    step: RunbookStep,
    stepRecord: ExecutionStepRecord,
    reason: string,
    adapters: Map<string, Adapter>,
    stepOutputs: Map<string, Record<string, unknown>>,
    approvals_required: ApprovalResult[]
  ): Promise<RunResult> {
    const execution = stored.execution;
    const actorId = execution.actor?.id;
    stepRecord.error = reason;
    stepRecord.completed_at = now();

    if (stepRecord.status !== "failed") {
      transitionStep(execution, stepRecord, "failed", { error: reason }, actorId);
    }

    if (step.on_failure === "rollback") {
      await this.rollbackExecution(stored, step, adapters, stepOutputs);
    } else {
      transitionExecution(execution, "failed", { failed_step: step.id, error: reason }, actorId);
    }

    const file = await this.persist(stored);
    return { execution, approvals_required, file };
  }

  private async rollbackExecution(
    stored: StoredExecutionRecord,
    failedStep: RunbookStep,
    adapters: Map<string, Adapter>,
    stepOutputs: Map<string, Record<string, unknown>>
  ): Promise<void> {
    const execution = stored.execution;
    const actor = execution.actor ?? resolveIdentity("root-agent");
    const failedIndex = execution.runbook.steps.findIndex((step) => step.id === failedStep.id);
    const rollbackCandidates =
      failedIndex >= 0
        ? execution.runbook.steps.slice(0, failedIndex).reverse()
        : [...execution.runbook.steps].reverse();

    emitEvent(
      execution,
      "rollback.started",
      { triggered_by: failedStep.id, execution_status: execution.status },
      undefined,
      actor.id
    );

    for (const candidateStep of rollbackCandidates) {
      const stepRecord = getStepRecord(execution, candidateStep.id);
      if (stepRecord.status !== "verified" || !stepRecord.outputs) {
        continue;
      }

      const capability = getCapability(candidateStep);
      const strategy = resolveRollbackStrategy(candidateStep, capability);
      if (!strategy) {
        continue;
      }

      const rollbackAttemptedAt = now();
      stepRecord.rollback = {
        status: "running",
        strategy,
        attempted_at: rollbackAttemptedAt
      };
      emitEvent(
        execution,
        "rollback.started",
        {
          triggered_by: failedStep.id,
          strategy
        },
        candidateStep.id,
        actor.id
      );

      if (strategy === "manual") {
        stepRecord.rollback = {
          status: "pending",
          strategy,
          attempted_at: rollbackAttemptedAt,
          error: candidateStep.compensation?.description ?? capability.rollback?.description ?? "Manual compensation required."
        };
        emitEvent(
          execution,
          "rollback.failed",
          {
            reason: stepRecord.rollback.error
          },
          candidateStep.id,
          actor.id
        );
        transitionExecution(execution, "failed", { failed_step: failedStep.id, rollback: "pending_manual" }, actor.id);
        return;
      }

      if (strategy === "capability") {
        stepRecord.rollback = {
          status: "failed",
          strategy,
          attempted_at: rollbackAttemptedAt,
          completed_at: now(),
          error: "Capability-based compensation is not implemented in the reference runtime."
        };
        emitEvent(
          execution,
          "rollback.failed",
          {
            reason: stepRecord.rollback.error
          },
          candidateStep.id,
          actor.id
        );
        transitionExecution(execution, "failed", { failed_step: failedStep.id, rollback: "unsupported_strategy" }, actor.id);
        return;
      }

      const adapter = adapters.get(candidateStep.provider);
      if (!adapter?.rollback) {
        stepRecord.rollback = {
          status: "failed",
          strategy,
          attempted_at: rollbackAttemptedAt,
          completed_at: now(),
          error: `No rollback support for provider ${candidateStep.provider}.`
        };
        emitEvent(
          execution,
          "rollback.failed",
          {
            reason: stepRecord.rollback.error
          },
          candidateStep.id,
          actor.id
        );
        transitionExecution(execution, "failed", { failed_step: failedStep.id, rollback: "adapter_missing" }, actor.id);
        return;
      }

      const resolved_input = resolveTemplate(candidateStep.with, buildResolutionContext(execution, stepOutputs));
      const context = buildStepContext(execution, actor, candidateStep, capability, stepRecord, resolved_input);
      const rollbackResult = await adapter.rollback(context, {
        status: "succeeded",
        outputs: stepRecord.outputs,
        ...(stepRecord.artifacts?.length ? { artifacts: stepRecord.artifacts } : {})
      });

      if (rollbackResult.artifacts?.length) {
        execution.artifacts.push(...rollbackResult.artifacts);
        stepRecord.artifacts = [...(stepRecord.artifacts ?? []), ...rollbackResult.artifacts];
      }

      if (rollbackResult.status !== "rolled_back") {
        stepRecord.rollback = {
          status: "failed",
          strategy,
          attempted_at: rollbackAttemptedAt,
          completed_at: now(),
          error: rollbackResult.error ?? `Rollback returned ${rollbackResult.status}.`
        };
        emitEvent(
          execution,
          "rollback.failed",
          {
            reason: stepRecord.rollback.error
          },
          candidateStep.id,
          actor.id
        );
        transitionExecution(execution, "failed", { failed_step: failedStep.id, rollback: rollbackResult.status }, actor.id);
        return;
      }

      stepRecord.rollback = {
        status: "rolled_back",
        strategy,
        attempted_at: rollbackAttemptedAt,
        completed_at: now()
      };
      stepRecord.completed_at = now();
      transitionStep(execution, stepRecord, "rolled_back", { triggered_by: failedStep.id }, actor.id);
      emitEvent(
        execution,
        "rollback.completed",
        {
          strategy
        },
        candidateStep.id,
        actor.id
      );
    }

    transitionExecution(execution, "rolled_back", { failed_step: failedStep.id }, actor.id);
    emitEvent(
      execution,
      "rollback.completed",
      { triggered_by: failedStep.id, execution_status: execution.status },
      undefined,
      actor.id
    );
  }

  private async execute(stored: StoredExecutionRecord, autoApprove: boolean): Promise<RunResult> {
    const execution = stored.execution;
    normalizeExecution(execution);
    execution.actor ??= resolveIdentity("root-agent");

    const adapters = createAdapters(stored.mode);
    const stepOutputs = new Map(
      execution.steps
        .filter((step): step is ExecutionStepRecord & { outputs: Record<string, unknown> } => Boolean(step.outputs))
        .map((step) => [step.step_id, step.outputs])
    );
    const approvals_required: ApprovalResult[] = [];

    for (const step of execution.runbook.steps) {
      const stepRecord = getStepRecord(execution, step.id);
      if (stepRecord.status !== "awaiting_approval") {
        continue;
      }

      if (stepRecord.approval?.status === "approved") {
        transitionStep(execution, stepRecord, "ready", {}, stepRecord.approval.actor ?? execution.actor.id);
        continue;
      }

      if (autoApprove) {
        stepRecord.approval = {
          ...(stepRecord.approval ?? {}),
          status: "approved",
          actor: execution.actor.id,
          timestamp: now(),
          note: stepRecord.approval?.note ?? "Auto-approved on resume."
        };
        emitEvent(
          execution,
          "approval.approved",
          { approval: stepRecord.approval.note ?? "approved" },
          step.id,
          execution.actor.id
        );
        transitionStep(execution, stepRecord, "ready", {}, execution.actor.id);
      }
    }

    if (hasTerminalExecutionState(execution)) {
      const file = await this.persist(stored);
      return { execution, approvals_required, file };
    }

    if (execution.status === "blocked") {
      const pendingApprovals = getPendingApprovalSteps(execution);
      if (pendingApprovals.length > 0 && !autoApprove) {
        approvals_required.push(
          ...pendingApprovals
            .map((step) => step.approval)
            .filter((approval): approval is ApprovalResult => Boolean(approval))
        );
        const file = await this.persist(stored);
        return { execution, approvals_required, file };
      }
    }

    if (execution.status === "created") {
      transitionExecution(execution, "planned", {}, execution.actor.id);
    }

    if (execution.status === "planned") {
      transitionExecution(execution, "running", {}, execution.actor.id);
    } else if (execution.status === "blocked") {
      transitionExecution(execution, "running", { reason: "Resumed execution." }, execution.actor.id);
    }

    let file = await this.persist(stored);

    while (true) {
      const readySteps = getReadySteps(execution);

      if (readySteps.length === 0) {
        const pendingApprovals = getPendingApprovalSteps(execution);
        if (pendingApprovals.length > 0) {
          approvals_required.push(
            ...pendingApprovals
              .map((step) => step.approval)
              .filter((approval): approval is ApprovalResult => Boolean(approval))
          );
          transitionExecution(execution, "blocked", { reason: "Pending approval." }, execution.actor.id);
          file = await this.persist(stored);
          return { execution, approvals_required, file };
        }

        if (execution.steps.some((step) => step.status === "failed")) {
          if (execution.status !== "failed" && execution.status !== "rolled_back") {
            transitionExecution(execution, "failed", { reason: "Execution ended with failed steps." }, execution.actor.id);
          }
          file = await this.persist(stored);
          return { execution, approvals_required, file };
        }

        if (!allStepsTerminal(execution)) {
          transitionExecution(execution, "failed", { reason: "Execution could not make progress." }, execution.actor.id);
          file = await this.persist(stored);
          return { execution, approvals_required, file };
        }

        break;
      }

      for (const step of readySteps) {
        const stepRecord = getStepRecord(execution, step.id);

        if (stepRecord.status === "pending") {
          transitionStep(execution, stepRecord, "ready", {}, execution.actor.id);
        }

        const capability = getCapability(step);
        const policy = this.evaluateStepPolicy(stored, step, capability, stepRecord);

        if (policy.final.effect === "deny") {
          return this.failStep(
            stored,
            step,
            stepRecord,
            policy.final.reason,
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        const requiresApproval = stepNeedsDeclaredApproval(step, capability) || policy.final.effect === "require_approval";
        if (requiresApproval && stepRecord.approval?.status !== "approved") {
          if (!autoApprove) {
            if (stepRecord.status !== "awaiting_approval") {
              transitionStep(execution, stepRecord, "awaiting_approval", {}, execution.actor.id);
            }

            stepRecord.approval = createApprovalResult(step, capability, false, execution.actor.id, policy.final);
            emitEvent(
              execution,
              "approval.requested",
              { approval: stepRecord.approval.note ?? "requested" },
              step.id,
              execution.actor.id
            );
            approvals_required.push(stepRecord.approval);
            transitionExecution(execution, "blocked", { reason: "Approval required." }, execution.actor.id);
            file = await this.persist(stored);
            return { execution, approvals_required, file };
          }

          stepRecord.approval = createApprovalResult(step, capability, true, execution.actor.id, policy.final);
          emitEvent(
            execution,
            "approval.approved",
            { approval: stepRecord.approval.note ?? "approved" },
            step.id,
            execution.actor.id
          );
          if (stepRecord.status === "awaiting_approval") {
            transitionStep(execution, stepRecord, "ready", {}, execution.actor.id);
          }
        }

        transitionStep(execution, stepRecord, "running", {}, execution.actor.id);
        stepRecord.attempts += 1;
        stepRecord.started_at = now();

        const adapter = adapters.get(step.provider);
        if (!adapter) {
          return this.failStep(
            stored,
            step,
            stepRecord,
            `No adapter for provider ${step.provider}`,
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        const resolved_input = resolveTemplate(step.with, buildResolutionContext(execution, stepOutputs));
        const context = buildStepContext(execution, execution.actor, step, capability, stepRecord, resolved_input);
        let result: ExecutionResult;

        emitEvent(
          execution,
          "adapter.execute.started",
          {
            provider: step.provider,
            capability: capability.capability,
            attempt: stepRecord.attempts
          },
          step.id,
          execution.actor.id
        );

        try {
          result = await adapter.execute(context);
        } catch (error: unknown) {
          return this.failStep(
            stored,
            step,
            stepRecord,
            error instanceof Error ? error.message : String(error),
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        emitEvent(
          execution,
          "adapter.execute.completed",
          {
            provider: step.provider,
            capability: capability.capability,
            status: result.status
          },
          step.id,
          execution.actor.id
        );

        if (result.artifacts?.length) {
          execution.artifacts.push(...result.artifacts);
          stepRecord.artifacts = [...(stepRecord.artifacts ?? []), ...result.artifacts];
        }

        if (result.status !== "succeeded") {
          return this.failStep(
            stored,
            step,
            stepRecord,
            result.error ?? "Execution failed",
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        stepRecord.outputs = result.outputs;
        stepOutputs.set(step.id, result.outputs);
        transitionStep(execution, stepRecord, "verifying", {}, execution.actor.id);

        let verification: VerificationResult;
        try {
          verification = await adapter.verify(context, result);
        } catch (error: unknown) {
          return this.failStep(
            stored,
            step,
            stepRecord,
            error instanceof Error ? error.message : String(error),
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        stepRecord.verification = verification;
        emitEvent(
          execution,
          "verification.completed",
          {
            verifier: verification.verifier,
            status: verification.status,
            confidence: verification.confidence
          },
          step.id,
          execution.actor.id
        );

        const verificationArtifact = createVerificationArtifact(execution, stepRecord);
        if (verificationArtifact) {
          execution.artifacts.push(verificationArtifact);
          stepRecord.artifacts = [...(stepRecord.artifacts ?? []), verificationArtifact];
        }

        if (verification.status !== "passed") {
          return this.failStep(
            stored,
            step,
            stepRecord,
            `Verification failed with status ${verification.status}`,
            adapters,
            stepOutputs,
            approvals_required
          );
        }

        transitionStep(execution, stepRecord, "verified", {}, execution.actor.id);
        stepRecord.completed_at = now();

        if (step.checkpoint?.enabled) {
          const checkpoint = createCheckpoint(execution, step, result.outputs);
          execution.checkpoints.push(checkpoint);
          emitEvent(
            execution,
            "checkpoint.created",
            {
              checkpoint_id: checkpoint.id,
              resumable_from: checkpoint.resumable_from
            },
            step.id,
            execution.actor.id
          );
        }

        file = await this.persist(stored);
      }
    }

    if (execution.status === "running") {
      transitionExecution(execution, "completed", {}, execution.actor.id);
    }

    file = await this.persist(stored);
    return { execution, approvals_required, file };
  }
}

class ModeBoundReferenceRuntime extends ReferenceRuntime {
  private readonly mode: ExecutionMode;

  constructor(mode: ExecutionMode, store?: FileExecutionStore) {
    super(store);
    this.mode = mode;
  }

  override async run(options: RunOptions): Promise<RunResult> {
    return super.run({
      ...options,
      mode: options.mode ?? this.mode
    });
  }
}

export function createReferenceRuntime(): ReferenceRuntime {
  return new ReferenceRuntime();
}

export function createReferenceRuntimeWithMode(mode: ExecutionMode): ReferenceRuntime {
  return new ModeBoundReferenceRuntime(mode);
}
