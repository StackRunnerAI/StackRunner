import type { Capability } from "../types/capability.js";

export const exampleCapabilities: Capability[] = [
  {
    capability: "auth.create_project",
    version: 1,
    provider: "auth0",
    category: "auth",
    risk_level: "medium",
    inputs: [
      { name: "project_name", type: "string", required: true },
      { name: "environment", type: "string", required: true }
    ],
    outputs: [{ name: "project_id", type: "string" }],
    verifier: {
      type: "provider_read",
      checks: [{ field: "project_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" },
    approval: {
      required: false,
      policy: "permission_escalation",
      reason: "Creates a new auth tenant project."
    },
    artifacts_emitted: [{ type: "provider_response" }]
  },
  {
    capability: "database.apply_schema",
    version: 1,
    provider: "supabase",
    category: "database",
    risk_level: "high",
    inputs: [
      { name: "project_id", type: "string", required: true },
      { name: "migration_path", type: "string", required: true }
    ],
    outputs: [{ name: "migration_version", type: "string" }],
    verifier: {
      type: "resource_diff",
      checks: [{ field: "schema_diff", condition: "empty" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}", scope: "provider" },
    rollback: {
      strategy: "manual",
      description: "Schema rollback requires an explicit migration."
    },
    approval: {
      required: true,
      policy: "destructive_delete",
      reason: "Schema changes can alter persistent state."
    },
    artifacts_emitted: [{ type: "migration_log" }]
  },
  {
    capability: "billing.create_product",
    version: 1,
    provider: "stripe",
    category: "billing",
    risk_level: "medium",
    inputs: [
      { name: "name", type: "string", required: true },
      { name: "price_cents", type: "integer", required: true }
    ],
    outputs: [
      { name: "product_id", type: "string" },
      { name: "price_id", type: "string" }
    ],
    verifier: {
      type: "provider_read",
      checks: [{ field: "product_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" },
    approval: {
      required: true,
      policy: "paid_resource_creation",
      reason: "Creates a billable product configuration."
    },
    artifacts_emitted: [{ type: "provider_response" }]
  },
  {
    capability: "billing.configure_webhook",
    version: 1,
    provider: "stripe",
    category: "billing",
    risk_level: "medium",
    inputs: [
      { name: "endpoint_url", type: "string", required: true },
      { name: "events", type: "array", required: true }
    ],
    outputs: [{ name: "webhook_id", type: "string" }],
    verifier: {
      type: "provider_read",
      checks: [{ field: "webhook_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}", scope: "provider" },
    postconditions: [{ field: "events", condition: "contains", value: "checkout.session.completed" }],
    artifacts_emitted: [{ type: "provider_response" }]
  },
  {
    capability: "email.configure_sender",
    version: 1,
    provider: "resend",
    category: "email",
    risk_level: "medium",
    inputs: [
      { name: "domain", type: "string", required: true },
      { name: "from_address", type: "string", required: true }
    ],
    outputs: [{ name: "sender_id", type: "string" }],
    verifier: {
      type: "provider_read",
      checks: [{ field: "sender_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" },
    artifacts_emitted: [{ type: "provider_response" }]
  },
  {
    capability: "deploy.create_project",
    version: 1,
    provider: "vercel",
    category: "deploy",
    risk_level: "medium",
    inputs: [{ name: "name", type: "string", required: true }],
    outputs: [{ name: "project_id", type: "string" }],
    verifier: {
      type: "provider_read",
      checks: [{ field: "project_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" }
  },
  {
    capability: "deploy.release_app",
    version: 1,
    provider: "vercel",
    category: "deploy",
    risk_level: "high",
    inputs: [
      { name: "project_id", type: "string", required: true },
      { name: "commit_sha", type: "string", required: true }
    ],
    outputs: [{ name: "deployment_url", type: "string" }],
    verifier: {
      type: "http_check",
      checks: [{ field: "deployment_url", condition: "http_2xx" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" },
    approval: {
      required: true,
      policy: "production_deploy",
      reason: "Deploying live code changes user-facing behavior."
    },
    rollback: {
      strategy: "compensating",
      capability: "deploy.release_app",
      description: "Redeploy the last known good release."
    },
    artifacts_emitted: [{ type: "deployment_url" }]
  },
  {
    capability: "dns.attach_domain",
    version: 1,
    provider: "cloudflare",
    category: "dns",
    risk_level: "high",
    inputs: [
      { name: "domain", type: "string", required: true },
      { name: "target", type: "string", required: true }
    ],
    outputs: [{ name: "record_id", type: "string" }],
    verifier: {
      type: "provider_read",
      checks: [{ field: "record_id", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}", scope: "provider" },
    approval: {
      required: true,
      policy: "dns_change",
      reason: "DNS mutations affect public routing."
    },
    artifacts_emitted: [{ type: "diff_report" }]
  },
  {
    capability: "verify.public_healthcheck",
    version: 1,
    provider: "http",
    category: "verify",
    risk_level: "low",
    inputs: [{ name: "url", type: "string", required: true }],
    outputs: [{ name: "status_code", type: "integer" }],
    verifier: {
      type: "http_check",
      checks: [{ field: "status_code", condition: "equals", value: 200 }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}" },
    artifacts_emitted: [{ type: "verification_proof" }]
  },
  {
    capability: "secrets.store_value",
    version: 1,
    provider: "doppler",
    category: "secrets",
    risk_level: "high",
    inputs: [
      { name: "key", type: "string", required: true },
      { name: "value", type: "string", required: true }
    ],
    outputs: [{ name: "secret_version", type: "string" }],
    verifier: {
      type: "artifact_check",
      checks: [{ field: "secret_version", condition: "exists" }]
    },
    idempotency: { key_template: "${execution.id}:${step.id}", scope: "provider" },
    approval: {
      required: true,
      policy: "permission_escalation",
      reason: "Secret mutations touch protected runtime configuration."
    },
    artifacts_emitted: [{ type: "env_file" }]
  }
];
