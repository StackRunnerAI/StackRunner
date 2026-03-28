import type { Runbook } from "../types/runbook.js";

export const saasBootstrapRunbook: Runbook = {
  version: 1,
  runbook: "saas-bootstrap",
  description: "Bootstraps the core external service surface for a SaaS application.",
  inputs: [
    { name: "project_name", type: "string", required: true },
    { name: "environment", type: "string", required: true },
    { name: "migration_path", type: "string", required: true },
    { name: "price_cents", type: "integer", required: true },
    { name: "sender_domain", type: "string", required: true },
    { name: "healthcheck_url", type: "string", required: true }
  ],
  steps: [
    {
      id: "auth_project",
      capability: "auth.create_project",
      provider: "auth0",
      with: {
        project_name: "${inputs.project_name}",
        environment: "${inputs.environment}"
      },
      depends_on: []
    },
    {
      id: "apply_schema",
      capability: "database.apply_schema",
      provider: "supabase",
      with: {
        project_id: "${steps.auth_project.outputs.project_id}",
        migration_path: "${inputs.migration_path}"
      },
      depends_on: ["auth_project"],
      approval: {
        required: true,
        policy: "destructive_delete",
        reason: "Database schema changes require review."
      }
    },
    {
      id: "billing_product",
      capability: "billing.create_product",
      provider: "stripe",
      with: {
        name: "${inputs.project_name}",
        price_cents: "${inputs.price_cents}"
      },
      depends_on: []
    },
    {
      id: "email_sender",
      capability: "email.configure_sender",
      provider: "resend",
      with: {
        domain: "${inputs.sender_domain}",
        from_address: "noreply@${inputs.sender_domain}"
      },
      depends_on: []
    },
    {
      id: "deploy_release",
      capability: "deploy.release_app",
      provider: "vercel",
      with: {
        project_id: "${inputs.project_name}",
        commit_sha: "${inputs.environment}"
      },
      depends_on: ["apply_schema", "billing_product", "email_sender"],
      approval: {
        required: true,
        policy: "production_deploy",
        reason: "Public release requires explicit approval."
      },
      emit_artifacts: [{ type: "deployment_url" }]
    },
    {
      id: "verify_public",
      capability: "verify.public_healthcheck",
      provider: "http",
      with: {
        url: "${inputs.healthcheck_url}"
      },
      depends_on: ["deploy_release"],
      checkpoint: {
        enabled: true,
        resumable_from: "verify_public",
        include_outputs: ["status_code"]
      }
    }
  ]
};

export const billingSetupRunbook: Runbook = {
  version: 1,
  runbook: "billing-setup",
  description: "Creates a billable product and verifies downstream billing webhooks.",
  inputs: [
    { name: "product_name", type: "string", required: true },
    { name: "price_cents", type: "integer", required: true },
    { name: "webhook_url", type: "string", required: true }
  ],
  steps: [
    {
      id: "create_product",
      capability: "billing.create_product",
      provider: "stripe",
      with: {
        name: "${inputs.product_name}",
        price_cents: "${inputs.price_cents}"
      },
      depends_on: []
    },
    {
      id: "configure_webhook",
      capability: "billing.configure_webhook",
      provider: "stripe",
      with: {
        endpoint_url: "${inputs.webhook_url}",
        events: ["checkout.session.completed", "invoice.paid"]
      },
      depends_on: ["create_product"]
    },
    {
      id: "verify_provider_state",
      capability: "verify.public_healthcheck",
      provider: "http",
      with: {
        url: "${inputs.webhook_url}"
      },
      depends_on: ["configure_webhook"],
      on_failure: "halt",
      emit_artifacts: [{ type: "verification_proof" }]
    }
  ]
};

export const stagingReleaseRunbook: Runbook = {
  version: 1,
  runbook: "staging-release",
  description: "Creates a staging deploy project, releases an app, verifies it, and checkpoints the result.",
  inputs: [
    { name: "project_name", type: "string", required: true },
    { name: "commit_sha", type: "string", required: true },
    { name: "healthcheck_url", type: "string", required: true }
  ],
  steps: [
    {
      id: "create_project",
      capability: "deploy.create_project",
      provider: "vercel",
      with: {
        name: "${inputs.project_name}"
      },
      depends_on: []
    },
    {
      id: "release_app",
      capability: "deploy.release_app",
      provider: "vercel",
      with: {
        project_id: "${steps.create_project.outputs.project_id}",
        commit_sha: "${inputs.commit_sha}"
      },
      depends_on: ["create_project"],
      emit_artifacts: [{ type: "deployment_url" }]
    },
    {
      id: "healthcheck",
      capability: "verify.public_healthcheck",
      provider: "http",
      with: {
        url: "${inputs.healthcheck_url}"
      },
      depends_on: ["release_app"],
      checkpoint: {
        enabled: true,
        resumable_from: "healthcheck",
        include_outputs: ["status_code"]
      }
    }
  ]
};

export const exampleRunbooks: Runbook[] = [
  saasBootstrapRunbook,
  billingSetupRunbook,
  stagingReleaseRunbook
];
