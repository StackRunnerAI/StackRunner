#!/usr/bin/env node

import { createReferenceRuntime, createReferenceRuntimeWithMode } from "./engine.js";
import type { ExecutionMode } from "./adapter-registry.js";
import { listIdentities } from "./identities.js";

type Command =
  | { name: "list"; json: boolean; mode: ExecutionMode }
  | { name: "run"; runbook: string; json: boolean; autoApprove: boolean; mode: ExecutionMode; inputs: Record<string, unknown>; identity?: string }
  | { name: "identities"; json: boolean }
  | { name: "evals"; json: boolean }
  | { name: "eval"; scenarioId: string; json: boolean }
  | { name: "executions"; json: boolean }
  | { name: "show"; executionId: string; json: boolean }
  | { name: "approve"; executionId: string; json: boolean; actor?: string; note?: string }
  | { name: "reject"; executionId: string; json: boolean; actor?: string; note?: string }
  | { name: "resume"; executionId: string; json: boolean; autoApprove: boolean };

function parseScalar(value: string): unknown {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseInputPair(pair: string): [string, unknown] {
  const separatorIndex = pair.indexOf("=");
  if (separatorIndex <= 0) {
    throw new Error(`Invalid --input value: ${pair}. Expected key=value.`);
  }

  return [pair.slice(0, separatorIndex), parseScalar(pair.slice(separatorIndex + 1))];
}

function requirePositional(token: string | undefined, label: string): string {
  if (!token || token.startsWith("--")) {
    throw new Error(`Missing ${label}`);
  }

  return token;
}

function usage(): string {
  return [
    "StackRunner reference runtime",
    "",
    "Commands:",
    "  stackrunner-demo list [--json] [--mode=mock|hybrid|real]",
    "  stackrunner-demo run <runbook> [--approve] [--json] [--mode=mock|hybrid|real] [--identity id] [--input key=value]",
    "  stackrunner-demo identities [--json]",
    "  stackrunner-demo evals [--json]",
    "  stackrunner-demo eval <scenarioId> [--json]",
    "  stackrunner-demo executions [--json]",
    "  stackrunner-demo show <executionId> [--json]",
    "  stackrunner-demo approve <executionId> [--actor name] [--note text] [--json]",
    "  stackrunner-demo reject <executionId> [--actor name] [--note text] [--json]",
    "  stackrunner-demo resume <executionId> [--approve] [--json]"
  ].join("\n");
}

function parseCommonFlags(argv: string[], startIndex: number): {
  json: boolean;
  autoApprove: boolean;
  mode: ExecutionMode;
  inputs: Record<string, unknown>;
  identity: string | undefined;
  actor: string | undefined;
  note: string | undefined;
} {
  let index = startIndex;
  let json = false;
  let autoApprove = false;
  let mode: ExecutionMode = "mock";
  const inputs: Record<string, unknown> = {};
  let identity: string | undefined;
  let actor: string | undefined;
  let note: string | undefined;

  while (index < argv.length) {
    const token = argv[index++];
    if (!token) {
      break;
    }

    if (token === "--json") {
      json = true;
      continue;
    }

    if (token === "--approve") {
      autoApprove = true;
      continue;
    }

    if (token === "--input") {
      const pair = argv[index++];
      if (!pair) {
        throw new Error("Missing value after --input");
      }
      const [key, value] = parseInputPair(pair);
      inputs[key] = value;
      continue;
    }

    if (token.startsWith("--input=")) {
      const [key, value] = parseInputPair(token.slice("--input=".length));
      inputs[key] = value;
      continue;
    }

    if (token === "--identity") {
      identity = requirePositional(argv[index++], "identity");
      continue;
    }

    if (token.startsWith("--identity=")) {
      identity = token.slice("--identity=".length);
      continue;
    }

    if (token === "--actor") {
      actor = requirePositional(argv[index++], "actor");
      continue;
    }

    if (token.startsWith("--actor=")) {
      actor = token.slice("--actor=".length);
      continue;
    }

    if (token === "--note") {
      note = requirePositional(argv[index++], "note");
      continue;
    }

    if (token.startsWith("--note=")) {
      note = token.slice("--note=".length);
      continue;
    }

    if (token.startsWith("--mode=")) {
      const value = token.slice("--mode=".length);
      if (value !== "mock" && value !== "hybrid" && value !== "real") {
        throw new Error(`Invalid mode: ${value}`);
      }
      mode = value;
      continue;
    }

    throw new Error(`Unknown flag: ${token}`);
  }

  return { json, autoApprove, mode, inputs, identity, actor, note };
}

function parseCommand(argv: string[]): Command {
  const [commandToken = "list"] = argv;

  switch (commandToken) {
    case "list": {
      const flags = parseCommonFlags(argv, 1);
      return { name: "list", json: flags.json, mode: flags.mode };
    }
    case "run": {
      const runbook = requirePositional(argv[1], "runbook");
      const flags = parseCommonFlags(argv, 2);
      return {
        name: "run",
        runbook,
        json: flags.json,
        autoApprove: flags.autoApprove,
        mode: flags.mode,
        inputs: flags.inputs,
        ...(flags.identity ? { identity: flags.identity } : {})
      };
    }
    case "identities": {
      const flags = parseCommonFlags(argv, 1);
      return { name: "identities", json: flags.json };
    }
    case "evals": {
      const flags = parseCommonFlags(argv, 1);
      return { name: "evals", json: flags.json };
    }
    case "eval": {
      const scenarioId = requirePositional(argv[1], "scenarioId");
      const flags = parseCommonFlags(argv, 2);
      return { name: "eval", scenarioId, json: flags.json };
    }
    case "executions": {
      const flags = parseCommonFlags(argv, 1);
      return { name: "executions", json: flags.json };
    }
    case "show": {
      const executionId = requirePositional(argv[1], "executionId");
      const flags = parseCommonFlags(argv, 2);
      return { name: "show", executionId, json: flags.json };
    }
    case "approve": {
      const executionId = requirePositional(argv[1], "executionId");
      const flags = parseCommonFlags(argv, 2);
      return {
        name: "approve",
        executionId,
        json: flags.json,
        ...(flags.actor ? { actor: flags.actor } : {}),
        ...(flags.note ? { note: flags.note } : {})
      };
    }
    case "reject": {
      const executionId = requirePositional(argv[1], "executionId");
      const flags = parseCommonFlags(argv, 2);
      return {
        name: "reject",
        executionId,
        json: flags.json,
        ...(flags.actor ? { actor: flags.actor } : {}),
        ...(flags.note ? { note: flags.note } : {})
      };
    }
    case "resume": {
      const executionId = requirePositional(argv[1], "executionId");
      const flags = parseCommonFlags(argv, 2);
      return {
        name: "resume",
        executionId,
        json: flags.json,
        autoApprove: flags.autoApprove
      };
    }
    default:
      throw new Error(`Unknown command: ${commandToken}`);
  }
}

function printRunSummary(result: Awaited<ReturnType<ReturnType<typeof createReferenceRuntime>["run"]>>): void {
  console.log(`Execution: ${result.execution.id}`);
  console.log(`Runbook: ${result.execution.runbook.runbook}`);
  console.log(`Status: ${result.execution.status}`);
  console.log(`Actor: ${result.execution.actor?.id ?? "unknown"}`);
  console.log(`State file: ${result.file}`);
  console.log("");
  console.log("Steps:");
  for (const step of result.execution.steps) {
    console.log(`- ${step.step_id}: ${step.status}`);
  }

  if (result.approvals_required.length) {
    console.log("");
    console.log("Approvals required:");
    for (const approval of result.approvals_required) {
      console.log(`- ${approval.note ?? approval.status}`);
    }
  }

  if (result.execution.checkpoints.length) {
    console.log("");
    console.log("Checkpoints:");
    for (const checkpoint of result.execution.checkpoints) {
      console.log(`- ${checkpoint.id} after ${checkpoint.after_step}`);
    }
  }

  if (result.execution.events.length) {
    console.log("");
    console.log(`Events: ${result.execution.events.length}`);
  }
}

function printEvalSummary(result: Awaited<ReturnType<ReturnType<typeof createReferenceRuntime>["runEvalScenario"]>>): void {
  console.log(`Scenario: ${result.scenario.id}`);
  console.log(`Description: ${result.scenario.description}`);
  console.log(`Expected: ${result.scenario.expected_outcome}`);
  console.log(`Passed: ${result.passed ? "yes" : "no"}`);
  console.log("");
  console.log("Assertions:");
  for (const assertion of result.assertions) {
    const target = assertion.assertion.target ? ` ${assertion.assertion.target}` : "";
    console.log(
      `- ${assertion.assertion.kind}${target}: ${assertion.passed ? "passed" : "failed"} (actual: ${JSON.stringify(assertion.actual)})`
    );
  }
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  const runtime = createReferenceRuntime();

  if (command.name === "list") {
    const modeRuntime = createReferenceRuntimeWithMode(command.mode);
    const runbooks = modeRuntime.listRunbooks().map((runbook) => ({
      runbook: runbook.runbook,
      description: runbook.description,
      steps: runbook.steps.length
    }));

    if (command.json) {
      console.log(JSON.stringify(runbooks, null, 2));
      return;
    }

    console.log("Available runbooks:");
    for (const runbook of runbooks) {
      console.log(`- ${runbook.runbook}: ${runbook.description} (${runbook.steps} steps)`);
    }
    return;
  }

  if (command.name === "identities") {
    const identities = listIdentities();
    if (command.json) {
      console.log(JSON.stringify(identities, null, 2));
      return;
    }

    console.log("Available identities:");
    for (const identity of identities) {
      console.log(`- ${identity.id}: ${identity.scopes.join(", ")}`);
    }
    return;
  }

  if (command.name === "evals") {
    const scenarios = runtime.listEvalScenarios().map((scenario) => ({
      id: scenario.id,
      runbook: scenario.runbook,
      actor: scenario.actor.id,
      description: scenario.description
    }));

    if (command.json) {
      console.log(JSON.stringify(scenarios, null, 2));
      return;
    }

    console.log("Eval scenarios:");
    for (const scenario of scenarios) {
      console.log(`- ${scenario.id}: ${scenario.description} [${scenario.actor} -> ${scenario.runbook}]`);
    }
    return;
  }

  if (command.name === "eval") {
    const result = await runtime.runEvalScenario(command.scenarioId);
    if (command.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printEvalSummary(result);
    return;
  }

  if (command.name === "executions") {
    const executions = await runtime.listExecutions();
    if (command.json) {
      console.log(JSON.stringify(executions, null, 2));
      return;
    }

    if (executions.length === 0) {
      console.log("No saved executions.");
      return;
    }

    console.log("Saved executions:");
    for (const execution of executions) {
      console.log(`- ${execution.id}: ${execution.runbook} (${execution.status})`);
    }
    return;
  }

  if (command.name === "show") {
    const record = await runtime.getExecution(command.executionId);
    if (command.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    console.log(`Execution: ${record.execution.id}`);
    console.log(`Runbook: ${record.execution.runbook.runbook}`);
    console.log(`Status: ${record.execution.status}`);
    console.log(`Actor: ${record.execution.actor?.id ?? "unknown"}`);
    console.log(`Mode: ${record.mode}`);
    console.log(`Events: ${record.execution.events.length}`);
    console.log("");
    for (const step of record.execution.steps) {
      console.log(`- ${step.step_id}: ${step.status}`);
    }
    return;
  }

  if (command.name === "approve") {
    const record = await runtime.approveExecution(command.executionId, {
      ...(command.actor ? { actor: command.actor } : {}),
      ...(command.note ? { note: command.note } : {})
    });
    if (command.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    console.log(`Approved pending steps for ${record.execution.id}.`);
    console.log(`Status: ${record.execution.status}`);
    return;
  }

  if (command.name === "reject") {
    const record = await runtime.rejectExecution(command.executionId, {
      ...(command.actor ? { actor: command.actor } : {}),
      ...(command.note ? { note: command.note } : {})
    });
    if (command.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    console.log(`Rejected pending steps for ${record.execution.id}.`);
    console.log(`Status: ${record.execution.status}`);
    return;
  }

  if (command.name === "resume") {
    const result = await runtime.resume(command.executionId, command.autoApprove);
    if (command.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printRunSummary(result);
    return;
  }

  const modeRuntime = createReferenceRuntimeWithMode(command.mode);
  const result = await modeRuntime.run({
    runbook: command.runbook,
    autoApprove: command.autoApprove,
    inputs: command.inputs,
    ...(command.identity ? { actor: command.identity } : {})
  });

  if (command.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printRunSummary(result);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  console.error(usage());
  process.exitCode = 1;
});
