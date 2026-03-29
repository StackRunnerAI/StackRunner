import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Execution } from "stackrunner-spec";
import type { ExecutionMode } from "./adapter-registry.js";

export interface StoredExecutionRecord {
  mode: ExecutionMode;
  execution: Execution;
}

export interface StoredExecutionSummary {
  id: string;
  runbook: string;
  status: Execution["status"];
  updated_at: string;
  path: string;
}

function defaultStateDir(): string {
  return process.env.STACKRUNNER_STATE_DIR || path.join(process.cwd(), ".stackrunner", "executions");
}

export class FileExecutionStore {
  readonly baseDir: string;

  constructor(baseDir: string = defaultStateDir()) {
    this.baseDir = baseDir;
  }

  private filePath(executionId: string): string {
    return path.join(this.baseDir, `${executionId}.json`);
  }

  async ensure(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }

  async save(record: StoredExecutionRecord): Promise<string> {
    await this.ensure();
    const file = this.filePath(record.execution.id);
    const tempFile = `${file}.tmp`;
    await writeFile(tempFile, JSON.stringify(record, null, 2), "utf8");
    await rename(tempFile, file);
    return file;
  }

  async load(executionId: string): Promise<StoredExecutionRecord> {
    const file = this.filePath(executionId);
    const contents = await readFile(file, "utf8");
    return JSON.parse(contents) as StoredExecutionRecord;
  }

  async list(): Promise<StoredExecutionSummary[]> {
    await this.ensure();
    const entries = await readdir(this.baseDir, { withFileTypes: true });
    const summaries = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map(async (entry) => {
          const file = path.join(this.baseDir, entry.name);
          const contents = await readFile(file, "utf8");
          const parsed = JSON.parse(contents) as StoredExecutionRecord;
          const info = await stat(file);
          return {
            id: parsed.execution.id,
            runbook: parsed.execution.runbook.runbook,
            status: parsed.execution.status,
            updated_at: parsed.execution.updated_at,
            path: file,
            mtimeMs: info.mtimeMs
          };
        })
    );

    return summaries
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .map(({ mtimeMs: _mtimeMs, ...summary }) => summary);
  }
}
