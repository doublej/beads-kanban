export type FileDiff = {
  path: string;
  operation: "created" | "modified" | "deleted";
  before: string | null;
  after: string | null;
};

export async function readFileContent(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return await file.text();
  }
  return null;
}

export async function snapshotFile(
  snapshots: Map<string, string | null>,
  touched: Set<string>,
  path: string
) {
  if (!snapshots.has(path)) {
    snapshots.set(path, await readFileContent(path));
  }
  touched.add(path);
}

export async function computeDiffs(
  snapshots: Map<string, string | null>,
  touched: Set<string>
): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];

  for (const path of touched) {
    const before = snapshots.get(path) ?? null;
    const after = await readFileContent(path);

    if (before === null && after !== null) {
      diffs.push({ path, operation: "created", before: null, after });
    } else if (before !== null && after === null) {
      diffs.push({ path, operation: "deleted", before, after: null });
    } else if (before !== after) {
      diffs.push({ path, operation: "modified", before, after });
    }
  }

  return diffs;
}

export function extractFilePath(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Edit" || toolName === "Write" || toolName === "Read") {
    return (input.file_path as string) || null;
  }
  if (toolName === "NotebookEdit") {
    return (input.notebook_path as string) || null;
  }
  return null;
}
