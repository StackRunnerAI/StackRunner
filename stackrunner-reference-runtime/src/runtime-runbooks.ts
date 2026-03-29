import type { Runbook } from "stackrunner-spec";
import { exampleRunbooks } from "stackrunner-spec";
import { deepClone } from "./utils.js";

export const liveHealthcheckRunbook: Runbook = {
  version: 1,
  runbook: "live-healthcheck",
  description: "Perform a real HTTP healthcheck against a live URL.",
  inputs: [{ name: "url", type: "string", required: true }],
  steps: [
    {
      id: "healthcheck",
      capability: "verify.public_healthcheck",
      provider: "http",
      with: {
        url: "${inputs.url}"
      },
      depends_on: [],
      checkpoint: {
        enabled: true,
        resumable_from: "healthcheck",
        include_outputs: ["status_code", "url"]
      }
    }
  ]
};

export const rollbackReleaseEvalRunbook: Runbook = {
  version: 1,
  runbook: "rollback-release-eval",
  description: "Simulate a risky release that must roll back when verification fails.",
  inputs: [
    { name: "project_name", type: "string", required: true },
    { name: "commit_sha", type: "string", required: true },
    { name: "failing_healthcheck_url", type: "string", required: true }
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
      compensation: {
        strategy: "adapter_rollback",
        description: "Redeploy the previous known-good release."
      }
    },
    {
      id: "verify_release",
      capability: "verify.public_healthcheck",
      provider: "http",
      with: {
        url: "${inputs.failing_healthcheck_url}"
      },
      depends_on: ["release_app"],
      on_failure: "rollback"
    }
  ]
};

export function getRuntimeRunbooks(): Runbook[] {
  return [
    ...exampleRunbooks.map((runbook) => deepClone(runbook)),
    deepClone(liveHealthcheckRunbook),
    deepClone(rollbackReleaseEvalRunbook)
  ];
}
