import type { EvalScenario } from "stackrunner-spec";
import { resolveIdentity } from "./identities.js";

export const evalScenarios: EvalScenario[] = [
  {
    id: "delegated-agent-denied-deploy",
    description: "A billing-scoped delegated agent should be denied deploy capabilities.",
    runbook: "staging-release",
    actor: resolveIdentity("billing-agent"),
    mode: "mock",
    auto_approve: true,
    inputs: {
      project_name: "demo",
      commit_sha: "abc123",
      healthcheck_url: "https://ok.local/health"
    },
    expected_outcome: "Execution fails because the actor lacks deploy permission.",
    assertions: [
      { kind: "execution_status", expected: "failed" },
      { kind: "policy_effect", target: "deploy.create_project", expected: "deny" }
    ]
  },
  {
    id: "delegated-release-needs-approval",
    description: "A delegated release agent should require approval for high-risk deploy work.",
    runbook: "staging-release",
    actor: resolveIdentity("release-agent"),
    mode: "mock",
    auto_approve: false,
    inputs: {
      project_name: "demo",
      commit_sha: "abc123",
      healthcheck_url: "https://ok.local/health"
    },
    expected_outcome: "Execution blocks on deploy approval.",
    assertions: [
      { kind: "execution_status", expected: "blocked" },
      { kind: "step_status", target: "release_app", expected: "awaiting_approval" }
    ]
  },
  {
    id: "rollback-on-healthcheck-failure",
    description: "A failed verification step should trigger rollback of prior release work.",
    runbook: "rollback-release-eval",
    actor: resolveIdentity("release-agent"),
    mode: "mock",
    auto_approve: true,
    inputs: {
      project_name: "demo",
      commit_sha: "abc123",
      failing_healthcheck_url: "https://fail.local/health"
    },
    expected_outcome: "Execution rolls back after the healthcheck fails.",
    assertions: [
      { kind: "execution_status", expected: "rolled_back" },
      { kind: "step_status", target: "release_app", expected: "rolled_back" },
      { kind: "event_type", expected: "rollback.completed" }
    ]
  }
];
