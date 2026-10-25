import type { StorageSnapshotMeta } from "@talweg/storage";
export interface LibraryIndex {
  directory: string;
  projects: (StorageSnapshotMeta & { filename: string })[];
  issues: string[];
  deletedIds: string[];
}
export type LibraryState = "browser" | "library" | "library-saving" | "library-error";
