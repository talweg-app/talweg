export interface HistoryPolicy {
  enabled: boolean;
  intervalMinutes: number;
  maxVersions: number;
  maxStorageMb: number;
}
export const DEFAULT_HISTORY_POLICY: HistoryPolicy = {
  enabled: true,
  intervalMinutes: 5,
  maxVersions: 100,
  maxStorageMb: 256,
};
export function parseHistoryPolicy(value: unknown): HistoryPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid history settings");
  const data = value as Record<string, unknown>;
  if (typeof data.enabled !== "boolean") throw new Error("Invalid history settings");
  for (const [key, min, max] of [["intervalMinutes", 1, 60], ["maxVersions", 5, 500], ["maxStorageMb", 16, 4096]] as const) {
    if (typeof data[key] !== "number" || !Number.isInteger(data[key]) || data[key] < min || data[key] > max)
      throw new Error("Invalid history settings");
  }
  return { enabled: data.enabled, intervalMinutes: data.intervalMinutes as number, maxVersions: data.maxVersions as number, maxStorageMb: data.maxStorageMb as number };
}
export interface ProjectVersion {
  id: string;
  projectId: string;
  createdAt: number;
  kind: "automatic" | "checkpoint";
  label: string;
  name: string;
  nodeCount: number;
  pageCount: number;
  bytes: number;
  hash: string;
  checksum?: string;
}
export interface ProjectHistoryIndex {
  versions: ProjectVersion[];
  totalBytes: number;
  issues: number;
  directory: string;
  policy: HistoryPolicy;
  warning: boolean;
}
export const validProjectId = (id: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
