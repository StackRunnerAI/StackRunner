# StackRunner Reference Runtime

This package is a minimal runnable reference layer for the StackRunner spec.

It is not the production runtime engine. It exists to demonstrate how the spec can be executed with:

- explicit step and execution state transitions
- scoped agent identity and delegated permissions
- policy evaluation before execution
- approval gates
- verification-before-completion
- canonical execution events
- artifact emission
- checkpoint creation
- rollback / compensation on failure paths

## Commands

From the repo root:

```sh
npm install
npm run build
npm run demo -- list
npm run demo -- identities
npm run demo -- evals
npm run demo -- run saas-bootstrap --approve --json
npm run demo -- eval delegated-release-needs-approval
```

## Scope

The reference runtime executes the example runbooks shipped by `stackrunner-spec` with durable local state. It uses mock adapters by default, and can switch to real adapters where credentials and network access are available.

Each run is executed under an agent identity, evaluated against the default policy set, and recorded as a canonical event stream. Risky paths can block for approval, fail on policy denial, or trigger rollback where compensation is defined.

Real external work is currently available for the `http` provider:

```sh
npm run demo -- run live-healthcheck --mode=real --input url=https://example.com
```

`--mode=hybrid` uses real adapters where available and falls back to mock adapters for the rest.

## Durable State

Executions are stored under `.stackrunner/executions` by default. You can inspect and resume them with:

```sh
npm run demo -- executions
npm run demo -- show <executionId>
npm run demo -- approve <executionId> --actor you
npm run demo -- resume <executionId>
```

Set `STACKRUNNER_STATE_DIR` to override the storage path.

## Governance And Evals

List the built-in agent identities:

```sh
npm run demo -- identities
```

Run the risky workflow eval scenarios:

```sh
npm run demo -- evals
npm run demo -- eval delegated-agent-denied-deploy
npm run demo -- eval delegated-release-needs-approval
npm run demo -- eval rollback-on-healthcheck-failure
```

## Real Providers

Real adapters currently include:

- `http`: live `verify.public_healthcheck`
- `stripe`: `billing.create_product` and `billing.configure_webhook`

Stripe requires:

```sh
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_DEFAULT_CURRENCY=usd
npm run demo -- run billing-setup --mode=hybrid --input product_name=Gold --input price_cents=2000 --input webhook_url=https://example.com/webhook
```
