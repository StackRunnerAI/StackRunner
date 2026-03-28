# Adapter Model

Adapters are the provider-facing boundary of a future StackRunner engine.

The spec exports:

- `Adapter`
- `CapabilityDescriptor`
- `ExecutionResult`
- `VerificationResult`
- `RollbackResult`
- `StepContext`

Core contract:

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

The adapter boundary is intentionally narrow:

- the spec owns capability semantics
- the engine owns orchestration and durable state
- the adapter owns provider-specific execution and verification

This keeps provider logic replaceable while preserving consistent governance and verification contracts across engines.
