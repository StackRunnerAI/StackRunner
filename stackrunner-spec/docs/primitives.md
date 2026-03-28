# Primitives

## Capability

A capability is a normalized external action. It defines:

- what inputs are required
- what outputs should exist
- how success is verified
- how idempotency is derived
- whether approval or rollback semantics apply

## Runbook

A runbook is a DAG of steps. Each step references a capability and binds concrete inputs to it. Steps can carry local policy such as timeout, retry, approval, artifact emission, and checkpointing.

## Execution

An execution is the durable record of a runbook instance. It tracks:

- current execution state
- per-step state
- emitted artifacts
- approval outcomes
- checkpoints

## Artifact

An artifact is a durable output linked to a step. Artifacts make execution inspectable and resumable.

Common examples in v0.1:

- provider responses
- deployment URLs
- migration logs
- verification proofs
- diff reports

## Approval

An approval is a policy gate. It records whether a step requires authorization and captures the outcome when that authorization is resolved.

## Checkpoint

A checkpoint is a verified recovery point. It exists so an engine can resume from a stable boundary rather than re-running arbitrary side effects.
