import type {
  Adapter,
  AdapterConfig,
  Artifact,
  Capability,
  CapabilityDescriptor,
  ExecutionResult,
  RollbackResult,
  StepContext,
  ValidationResult,
  VerificationResult
} from "stackrunner-spec";
import { exampleCapabilities } from "stackrunner-spec";
import { formatTimestamp, slugify } from "./utils.js";

function makeArtifact(
  step: StepContext,
  type: string,
  metadata: Record<string, unknown>
): Artifact {
  return {
    id: `artifact_${step.execution.id}_${step.step.id}_${type}`,
    step_id: step.step.id,
    type,
    uri: `memory://${step.execution.id}/${step.step.id}/${type}`,
    metadata
  };
}

function buildOutputs(step: StepContext): Record<string, unknown> {
  const suffix = `${step.execution.id}_${step.step.id}`;
  const inputs = step.resolved_input;

  switch (step.capability.capability) {
    case "auth.create_project":
      return {
        project_id: `authproj_${slugify(String(inputs.project_name ?? suffix))}`
      };
    case "database.apply_schema":
      return {
        migration_version: `migration_${slugify(String(inputs.migration_path ?? suffix))}`
      };
    case "billing.create_product":
      return {
        product_id: `prod_${suffix}`,
        price_id: `price_${suffix}`
      };
    case "billing.configure_webhook":
      return {
        webhook_id: `wh_${suffix}`
      };
    case "email.configure_sender":
      return {
        sender_id: `sender_${slugify(String(inputs.from_address ?? suffix))}`
      };
    case "deploy.create_project":
      return {
        project_id: `deployproj_${slugify(String(inputs.name ?? suffix))}`
      };
    case "deploy.release_app":
      return {
        deployment_url: `https://${slugify(String(inputs.project_id ?? "app"))}.stackrunner.local/${slugify(String(inputs.commit_sha ?? "current"))}`
      };
    case "dns.attach_domain":
      return {
        record_id: `dns_${suffix}`
      };
    case "verify.public_healthcheck":
      if (typeof inputs.url === "string" && /(fail|down|503)/i.test(inputs.url)) {
        return {
          status_code: 503
        };
      }
      return {
        status_code: 200
      };
    case "secrets.store_value":
      return {
        secret_version: `secret_${suffix}`
      };
    default:
      return {
        result_id: `result_${suffix}`
      };
  }
}

function buildObservedState(step: StepContext, result: ExecutionResult): Record<string, unknown> {
  switch (step.capability.verifier.type) {
    case "resource_diff":
      return {
        ...result.outputs,
        schema_diff: []
      };
    case "http_check":
      if ("deployment_url" in result.outputs) {
        return {
          ...result.outputs,
          status_code: 200
        };
      }

      return result.outputs;
    default:
      return result.outputs;
  }
}

function passesChecks(
  checks: Capability["verifier"]["checks"],
  observedState: Record<string, unknown>
): boolean {
  return checks.every((check) => {
    const value = observedState[check.field];

    switch (check.condition) {
      case "exists":
        return value !== undefined && value !== null && value !== "";
      case "equals":
        return value === check.value;
      case "contains":
        return Array.isArray(value) ? value.includes(check.value) : String(value).includes(String(check.value));
      case "empty":
        return Array.isArray(value) ? value.length === 0 : value === "";
      case "http_2xx":
        return typeof observedState.status_code === "number" &&
          observedState.status_code >= 200 &&
          observedState.status_code < 300;
      default:
        return true;
    }
  });
}

export class MockAdapter implements Adapter {
  readonly name: string;
  private readonly capabilities: Capability[];

  constructor(name: string, capabilities: Capability[]) {
    this.name = name;
    this.capabilities = capabilities;
  }

  supports(): CapabilityDescriptor[] {
    return this.capabilities.map((capability) => ({
      capability: capability.capability,
      version: capability.version,
      provider: capability.provider,
      category: capability.category
    }));
  }

  async validate(_config: AdapterConfig): Promise<ValidationResult> {
    return { valid: true };
  }

  async execute(step: StepContext): Promise<ExecutionResult> {
    const outputs = buildOutputs(step);
    const artifacts: Artifact[] = [
      makeArtifact(step, "provider_response", {
        provider: step.step.provider,
        capability: step.capability.capability,
        outputs
      })
    ];

    if (step.step.emit_artifacts) {
      for (const descriptor of step.step.emit_artifacts) {
        artifacts.push(makeArtifact(step, descriptor.type, { source: "step.emit_artifacts" }));
      }
    }

    return {
      status: "succeeded",
      outputs,
      artifacts,
      provider_response: {
        provider: step.step.provider,
        executed_at: formatTimestamp(new Date()),
        idempotency_key: `${step.execution.id}:${step.step.id}:${step.attempt}`
      }
    };
  }

  async verify(step: StepContext, result: ExecutionResult): Promise<VerificationResult> {
    const observed_state = buildObservedState(step, result);
    const passed = passesChecks(step.capability.verifier.checks, observed_state);

    return {
      status: passed ? "passed" : "failed",
      observed_state,
      proof: [
        {
          type: "mock_verification",
          uri: `memory://${step.execution.id}/${step.step.id}/verification`,
          metadata: {
            provider: step.step.provider,
            verifier: step.capability.verifier.type
          }
        }
      ],
      confidence: passed ? 0.98 : 0.2,
      verifier: step.capability.verifier.type,
      checked_at: formatTimestamp(new Date())
    };
  }

  async rollback(step: StepContext, _result: ExecutionResult): Promise<RollbackResult> {
    if (!step.capability.rollback) {
      return { status: "not_supported" };
    }

    return {
      status: "rolled_back",
      artifacts: [
        makeArtifact(step, "diff_report", {
          rollback_strategy: step.capability.rollback.strategy
        })
      ]
    };
  }
}

export function createMockAdapters(): Map<string, Adapter> {
  const byProvider = new Map<string, Capability[]>();

  for (const capability of exampleCapabilities) {
    const bucket = byProvider.get(capability.provider) ?? [];
    bucket.push(capability);
    byProvider.set(capability.provider, bucket);
  }

  return new Map(
    Array.from(byProvider.entries()).map(([provider, capabilities]) => [
      provider,
      new MockAdapter(`mock-${provider}`, capabilities)
    ])
  );
}
