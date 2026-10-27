import { mkdir, readdir, readFile, rename, writeFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { deserializeTalwegFile } from "@talweg/storage";
import { DEFAULT_HISTORY_POLICY, parseHistoryPolicy, validProjectId, type HistoryPolicy, type ProjectVersion, type ProjectHistoryIndex } from "../src/types/projectHistory.js";

const compress = promisify(gzip), decompress = promisify(gunzip);
const MAX_FILE_BYTES = 100 * 1024 * 1024;
export class ProjectHistory {
  private policyWrites = Promise.resolve();
  private readonly latest = new Map<string, ProjectVersion>();
  readonly failures = new Set<string>();
  constructor(readonly directory: string) {}
  async policy(): Promise<HistoryPolicy> {
    try { return parseHistoryPolicy(JSON.parse(await readFile(join(this.directory, "settings.json"), "utf8")) as unknown); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULT_HISTORY_POLICY };
      throw error;
    }
  }
  savePolicy(input: unknown): Promise<HistoryPolicy> {
    const policy = parseHistoryPolicy(input);
    const operation = this.policyWrites.catch(() => undefined).then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = join(this.directory, `.settings-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(policy), { flag: "wx", mode: 0o600 });
      await rename(temporary, join(this.directory, "settings.json"));
    });
    this.policyWrites = operation;
    return operation.then(() => policy);
  }
  private projectPath(id: string): string {
    if (!validProjectId(id)) throw new Error("Invalid project id");
    return join(this.directory, id);
  }
  async list(id: string): Promise<ProjectHistoryIndex> {
    const directory = this.projectPath(id);
    const policy = await this.policy();
    let names: string[];
    try { names = await readdir(directory); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      names = [];
    }
    const versions: ProjectVersion[] = [];
    let issues = 0;
    for (const name of names.filter(validProjectId)) {
      try {
        const metadata: unknown = JSON.parse(await readFile(join(directory, name, "metadata.json"), "utf8"));
        if (!metadata || typeof metadata !== "object") throw new Error("Invalid version");
        const version = metadata as ProjectVersion;
        if (version.id !== name || version.projectId !== id || typeof version.name !== "string" || typeof version.label !== "string" ||
          !["automatic", "checkpoint"].includes(version.kind) || !Number.isFinite(version.createdAt) ||
          !Number.isInteger(version.bytes) || version.bytes < 1 || !Number.isInteger(version.nodeCount) || !Number.isInteger(version.pageCount) ||
          typeof version.hash !== "string" || !/^[a-f0-9]{64}$/.test(version.hash)) throw new Error("Invalid version");
        const file = await stat(join(directory, name, "project.talweg.gz"));
        if (!file.isFile() || file.size !== version.bytes || (version.checksum !== undefined && (typeof version.checksum !== "string" || !/^[a-f0-9]{64}$/.test(version.checksum)))) throw new Error("Incomplete version");
        versions.push(version);
      } catch { issues++; }
    }
    versions.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
    return { versions, totalBytes: versions.reduce((sum, version) => sum + version.bytes, 0), issues, directory, policy, warning: this.failures.has(id) };
  }
  async record(id: string, source: string, label?: string): Promise<ProjectVersion | null> {
    const directory = this.projectPath(id);
    const policy = await this.policy();
    if (label === undefined && !policy.enabled) { this.failures.delete(id); return null; }
    const recent = this.latest.get(id);
    if (label === undefined && recent && Date.now() - recent.createdAt < policy.intervalMinutes * 60000) return null;
    const index = await this.list(id);
    if (Buffer.byteLength(source) > MAX_FILE_BYTES) throw new Error("Project exceeds 100 MB");
    const snapshot = deserializeTalwegFile(source);
    let version: ProjectVersion;
    try {
      if (snapshot.doc.id !== id) throw new Error("Project id mismatch");
      const hash = createHash("sha256").update(JSON.stringify({ crdt: snapshot.rawContainer.crdtUpdate, assets: snapshot.rawContainer.assets })).digest("hex");
      const latest = index.versions[0];
      if (latest) this.latest.set(id, latest);
      if (label === undefined && latest && (latest.hash === hash || Date.now() - latest.createdAt < index.policy.intervalMinutes * 60000)) return null;
      const content = await compress(source);
      // retain existing versions when a snapshot cannot fit the budget.
      if (content.length > index.policy.maxStorageMb * 1024 * 1024) throw new Error("Version exceeds history storage limit");
      const createdAt = Math.max(Date.now(), (index.versions[0]?.createdAt ?? 0) + 1);
      version = { id: `${String(createdAt)}-${randomUUID()}`, projectId: id, createdAt, kind: label === undefined ? "automatic" : "checkpoint", label: label?.trim().slice(0, 100) ?? "", name: snapshot.doc.name, nodeCount: Object.keys(snapshot.doc.nodes).length, pageCount: Object.keys(snapshot.doc.pages ?? {}).length || 1, bytes: content.length, hash, checksum: createHash("sha256").update(source).digest("hex") };
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = join(directory, `.pending-${randomUUID()}`);
      await mkdir(temporary, { mode: 0o700 });
      try {
        await writeFile(join(temporary, "project.talweg.gz"), content, { mode: 0o600, flag: "wx" });
        await writeFile(join(temporary, "metadata.json"), JSON.stringify(version), { mode: 0o600, flag: "wx" });
        await rename(temporary, join(directory, version.id));
      } catch (error) { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); throw error; }
    } finally { snapshot.ydoc.destroy(); }
    const retained = [version, ...index.versions];
    let totalBytes = retained.reduce((sum, item) => sum + item.bytes, 0);
    while (retained.length > 1 && (retained.length > index.policy.maxVersions || totalBytes > index.policy.maxStorageMb * 1024 * 1024)) {
      const oldest = retained.pop();
      if (!oldest) break;
      await rm(join(directory, oldest.id), { recursive: true });
      totalBytes -= oldest.bytes;
    }
    this.latest.set(id, version);
    this.failures.delete(id);
    return version;
  }
  async purge(id: string): Promise<void> {
    await rm(this.projectPath(id), { recursive: true, force: true });
    this.latest.delete(id);
    this.failures.delete(id);
  }
  async read(id: string, versionId: string): Promise<string> {
    if (!validProjectId(versionId)) throw new Error("Invalid version id");
    const directory = this.projectPath(id);
    const metadata = (await this.list(id)).versions.find(version => version.id === versionId);
    if (!metadata) throw new Error("Version not found");
    const bytes = await readFile(join(directory, versionId, "project.talweg.gz"));
    const source = (await decompress(bytes, { maxOutputLength: MAX_FILE_BYTES })).toString("utf8");
    if (metadata.checksum && createHash("sha256").update(source).digest("hex") !== metadata.checksum) throw new Error("Version integrity check failed");
    const snapshot = deserializeTalwegFile(source);
    try {
      const hash = createHash("sha256").update(JSON.stringify({ crdt: snapshot.rawContainer.crdtUpdate, assets: snapshot.rawContainer.assets })).digest("hex");
      if (snapshot.doc.id !== id || hash !== metadata.hash) throw new Error("Version integrity check failed");
    } finally { snapshot.ydoc.destroy(); }
    return source;
  }
}
