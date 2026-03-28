# Overview

StackRunner is an open spec for governed, verifiable, durable agent execution across external services.

The problem it targets is not code generation. The problem is reliable execution across fragmented systems where a useful runtime must handle:

- durable state
- verification
- approvals
- retries
- resumability
- artifacts
- rollback semantics

`stackrunner-spec` v0.1 defines the language for that execution model. It does not implement the engine that executes it.

Use the spec to standardize:

- capability definitions
- runbook definitions
- execution records
- adapter interfaces
- state transition rules

The intended layering is:

1. `stackrunner-spec` defines the contract.
2. engines implement planning, persistence, scheduling, and recovery.
3. adapters implement provider-specific execution and verification.
