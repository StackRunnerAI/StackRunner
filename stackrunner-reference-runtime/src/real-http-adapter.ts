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
import { formatTimestamp } from "./utils.js";

function makeArtifact(step: StepContext, type: string, uri: string, metadata: Record<string, unknown>): Artifact {
  return {
    id: `artifact_${step.execution.id}_${step.step.id}_${type}`,
    step_id: step.step.id,
    type,
    uri,
    metadata
  };
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
      case "http_2xx":
        return typeof observedState.status_code === "number" &&
          observedState.status_code >= 200 &&
          observedState.status_code < 300;
      default:
        return true;
    }
  });
}

function requireUrl(step: StepContext): string {
  const url = step.resolved_input.url;
  if (typeof url !== "string" || url.trim() === "") {
    throw new Error(`Step ${step.step.id} requires a non-empty url input`);
  }

  return url;
}

export class RealHttpAdapter implements Adapter {
  readonly name = "real-http";
  private readonly capabilities = exampleCapabilities.filter((capability) => capability.provider === "http");

  supports(): CapabilityDescriptor[] {
    return this.capabilities.map((capability) => ({
      capability: capability.capability,
      version: capability.version,
      provider: capability.provider,
      category: capability.category
    }));
  }

  async validate(_config: AdapterConfig): Promise<ValidationResult> {
    return { valid: typeof fetch === "function" };
  }

  async execute(step: StepContext): Promise<ExecutionResult> {
    if (step.capability.capability !== "verify.public_healthcheck") {
      return {
        status: "failed",
        outputs: {},
        error: `Real HTTP adapter does not support ${step.capability.capability}`
      };
    }

    const url = requireUrl(step);
    const startedAt = Date.now();
    const timeout_ms = (step.step.timeout?.seconds ?? 15) * 1000;
    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(timeout_ms)
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.cause instanceof Error
            ? `${error.message}: ${error.cause.message}`
            : error.message
          : String(error);

      throw new Error(`HTTP request failed for ${url}: ${message}`);
    }

    const duration_ms = Date.now() - startedAt;
    const headers = Object.fromEntries(response.headers.entries());
    const outputs = {
      status_code: response.status,
      url: response.url
    };

    return {
      status: "succeeded",
      outputs,
      artifacts: [
        makeArtifact(step, "provider_response", response.url, {
          provider: step.step.provider,
          capability: step.capability.capability,
          status: response.status,
          status_text: response.statusText,
          duration_ms,
          headers
        })
      ],
      provider_response: {
        status: response.status,
        status_text: response.statusText,
        headers,
        duration_ms
      }
    };
  }

  async verify(step: StepContext, result: ExecutionResult): Promise<VerificationResult> {
    const observed_state = {
      status_code: result.outputs.status_code,
      url: result.outputs.url ?? requireUrl(step)
    };
    const passed = passesChecks(step.capability.verifier.checks, observed_state);

    return {
      status: passed ? "passed" : "failed",
      observed_state,
      proof: [
        {
          type: "http_response",
          uri: String(observed_state.url),
          metadata: {
            status_code: observed_state.status_code
          }
        }
      ],
      confidence: passed ? 0.99 : 0.2,
      verifier: step.capability.verifier.type,
      checked_at: formatTimestamp(new Date())
    };
  }

  async rollback(_step: StepContext, _result: ExecutionResult): Promise<RollbackResult> {
    return { status: "not_supported" };
  }
}
