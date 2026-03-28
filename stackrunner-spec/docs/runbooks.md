# Runbooks

A runbook is a directed acyclic graph of governed execution steps.

Required top-level fields:

- `version`
- `runbook`
- `description`
- `inputs`
- `steps`

Required fields for each step:

- `id`
- `capability`
- `provider`
- `with`
- `depends_on`

Optional step controls:

- `approval`
- `retry_policy`
- `timeout`
- `on_failure`
- `emit_artifacts`
- `checkpoint`

Design intent:

- capabilities define what a step means
- runbooks define how those steps compose
- engines decide scheduling based on dependency readiness and policy state

In v0.1, runbooks are declarative. They do not embed execution code or provider-specific scripts.
