import type { AgentIdentity } from "stackrunner-spec";
import { deepClone } from "./utils.js";

export const runtimeIdentities: AgentIdentity[] = [
  {
    id: "root-agent",
    type: "agent",
    display_name: "Root Agent",
    scopes: ["*"],
    permissions: [{ resource: "*", actions: ["*"] }]
  },
  {
    id: "billing-agent",
    type: "agent",
    display_name: "Billing Agent",
    scopes: ["billing", "verify"],
    delegated_by: "root-agent",
    permissions: [
      {
        resource: "capability:billing.create_product",
        actions: ["execute", "verify"],
        delegated_by: "root-agent",
        reason: "Provision billing products"
      },
      {
        resource: "capability:billing.configure_webhook",
        actions: ["execute", "verify", "rollback"],
        delegated_by: "root-agent",
        reason: "Manage billing webhook endpoints"
      },
      {
        resource: "capability:verify.public_healthcheck",
        actions: ["execute", "verify"],
        delegated_by: "root-agent",
        reason: "Verify billing endpoints"
      }
    ]
  },
  {
    id: "release-agent",
    type: "agent",
    display_name: "Release Agent",
    scopes: ["deploy", "verify"],
    delegated_by: "root-agent",
    permissions: [
      {
        resource: "capability:deploy.create_project",
        actions: ["execute", "verify"],
        delegated_by: "root-agent",
        reason: "Provision deploy projects"
      },
      {
        resource: "capability:deploy.release_app",
        actions: ["execute", "verify", "rollback"],
        delegated_by: "root-agent",
        reason: "Release applications"
      },
      {
        resource: "capability:verify.public_healthcheck",
        actions: ["execute", "verify"],
        delegated_by: "root-agent",
        reason: "Verify releases"
      }
    ]
  },
  {
    id: "verifier-agent",
    type: "agent",
    display_name: "Verifier Agent",
    scopes: ["verify"],
    delegated_by: "root-agent",
    permissions: [
      {
        resource: "category:verify",
        actions: ["execute", "verify"],
        delegated_by: "root-agent",
        reason: "Run verification-only steps"
      }
    ]
  }
];

const identities = new Map(runtimeIdentities.map((identity) => [identity.id, identity]));

export function listIdentities(): AgentIdentity[] {
  return runtimeIdentities.map((identity) => deepClone(identity));
}

export function resolveIdentity(identityId = "root-agent"): AgentIdentity {
  const identity = identities.get(identityId);
  if (!identity) {
    throw new Error(`Unknown identity: ${identityId}`);
  }

  return deepClone(identity);
}
