# StackRunner
Open spec for governed, verifiable, durable agent execution across external services.
# StackRunner Spec

StackRunner is an open spec for governed, verifiable, durable agent execution across external services.  
It exists because the hard part of agentic systems is not generating code, but executing safely and reliably across fragmented tools, APIs, and providers.

`stackrunner-spec` is the spec layer for that model.

It defines the language that future engines and adapters can implement:

- capabilities
- runbooks
- executions
- artifacts
- approvals
- checkpoints
- verification contracts
- adapter contracts
- execution state machines

This package is not an engine. It does not execute steps, call providers, plan tasks, or host a control plane.

## Why This Exists

The real bottleneck in agentic software is durable execution across external systems:

- auth
- databases
- billing
- email
- deploys
- DNS
- secrets
- approvals
- verification
- retries
- rollback

Tool calling is not enough. A useful agent runtime needs explicit contracts for what a step does, how success is verified, when approval is required, what artifacts are produced, and where execution can resume after interruption.

## Scope

`stackrunner-spec` v0.1 includes:

- TypeScript types for the spec primitives
- JSON Schema artifacts for core objects
- explicit execution and step state machines
- an adapter interface for future engines
- a standard example capability set
- example runbooks
- concise reference docs

Non-goals for this package:

- runtime engine
- CLI
- provider integrations
- browser automation
- multi-agent framework
- natural-language planner
- hosted control plane

## Package Layout

```text
stackrunner-spec/
  src/
    examples/
    schemas/
    state-machine/
    types/
  docs/
  README.md
  package.json
  tsconfig.json
```

## Core Primitives

- `Capability`: a normalized provider action with inputs, outputs, verification, idempotency, and risk metadata.
- `Runbook`: a DAG of capability steps with dependencies and per-step governance controls.
- `Execution`: the durable state of a runbook in flight, including step results, artifacts, approvals, and checkpoints.
- `Artifact`: a durable output emitted by a step or verifier.
- `Approval`: a policy gate that can block execution until a human or system decision is recorded.
- `Checkpoint`: a resumable, verified recovery point.

## Capability Naming

Capability names follow:

```text
<domain>.<action>_<object>
```

Examples:

- `billing.create_product`
- `billing.configure_webhook`
- `auth.create_project`
- `database.apply_schema`
- `deploy.release_app`
- `dns.attach_domain`
- `email.configure_sender`
- `verify.public_healthcheck`
- `secrets.store_value`

The exported naming regex is `CAPABILITY_NAME_PATTERN`.

## Verification Model

A step is not complete when a provider call returns. A step is complete when verification succeeds.

Supported verifier types in v0.1:

- `provider_read`
- `http_check`
- `resource_diff`
- `artifact_check`
- `custom`

Verification results include:

- `status`
- `observed_state`
- `proof`
- `confidence`

## State Machines

Execution states:

- `created`
- `planned`
- `running`
- `blocked`
- `failed`
- `completed`
- `rolled_back`
- `cancelled`

Step states:

- `pending`
- `ready`
- `running`
- `awaiting_approval`
- `verifying`
- `verified`
- `failed`
- `blocked`
- `rolled_back`
- `skipped`

The package exports both transition maps and helper functions:

- `EXECUTION_TRANSITIONS`
- `STEP_TRANSITIONS`
- `canTransitionExecution()`
- `canTransitionStep()`

## Adapter Contract

Future engines can implement the exported `Adapter` interface:

```ts
interface Adapter {
  name: string
  supports(): CapabilityDescriptor[]
  validate(config: AdapterConfig): Promise<ValidationResult>
  execute(step: StepContext): Promise<ExecutionResult>
  verify(step: StepContext, result: ExecutionResult): Promise<VerificationResult>
  rollback?(step: StepContext, result: ExecutionResult): Promise<RollbackResult>
}
```

The contract is intentionally narrow. It standardizes execution and verification boundaries without prescribing engine internals.

## Example Coverage

The package ships with 10 example capabilities:

- `auth.create_project`
- `database.apply_schema`
- `billing.create_product`
- `billing.configure_webhook`
- `email.configure_sender`
- `deploy.create_project`
- `deploy.release_app`
- `dns.attach_domain`
- `verify.public_healthcheck`
- `secrets.store_value`

It also ships with 3 example runbooks:

- `saas-bootstrap`
- `billing-setup`
- `staging-release`

## Getting Started

```ts
import {
  capabilitySchema,
  exampleCapabilities,
  exampleRunbooks,
  EXECUTION_TRANSITIONS
} from "stackrunner-spec";
```

Use this package when defining:

- provider capability descriptors
- engine-side validators
- runbook authorship tooling
- adapter contracts
- state transition guards

## Docs

- [Overview](./docs/overview.md)
- [Primitives](./docs/primitives.md)
- [Capability Naming](./docs/capability-naming.md)
- [Runbooks](./docs/runbooks.md)
- [State Machine](./docs/state-machine.md)
- [Verification and Approvals](./docs/verification-approvals.md)
- [Adapter Model](./docs/adapter-model.md)
