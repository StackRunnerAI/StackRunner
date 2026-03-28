# Verification And Approvals

## Verification

Verification is a first-class contract in StackRunner. A provider response alone is not enough to mark a step complete.

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

This makes step completion auditable and allows engines to distinguish between provider acknowledgement and durable success.

## Approvals

Approvals are explicit policy gates.

Approval fields:

- `required`
- `policy`
- `reason`

Approval result fields:

- `status`
- `actor`
- `timestamp`
- `note`

Supported approval statuses:

- `requested`
- `approved`
- `rejected`
- `expired`

Common policy names:

- `production_deploy`
- `paid_resource_creation`
- `dns_change`
- `destructive_delete`
- `permission_escalation`

The spec defines the contract only. Engines decide how approval requests are routed, persisted, expired, and surfaced to operators.
