import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import type { ToolId } from "./tools.js";

export type SessionRecord = {
  id: string;
  createdAt: string;
  tool: ToolId | string;
  target: string;
  title: string;
  summary: string;
  lines: string[];
  data: unknown;
};

function rootDir() {
  const dir = join(homedir(), ".evron", "sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function exportsDir() {
  const dir = join(homedir(), ".evron", "exports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveSession(
  input: Omit<SessionRecord, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): SessionRecord {
  const record: SessionRecord = {
    id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    tool: input.tool,
    target: input.target,
    title: input.title,
    summary: input.summary,
    lines: input.lines,
    data: input.data,
  };
  writeFileSync(
    join(rootDir(), `${record.id}.json`),
    JSON.stringify(record, null, 2),
    "utf8",
  );
  return record;
}

export function listSessions(): SessionRecord[] {
  const dir = rootDir();
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(
          readFileSync(join(dir, name), "utf8"),
        ) as SessionRecord;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is SessionRecord => Boolean(entry))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSession(id: string): SessionRecord | null {
  const path = join(rootDir(), `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SessionRecord;
  } catch {
    return null;
  }
}

export function deleteSession(id: string) {
  const path = join(rootDir(), `${id}.json`);
  if (existsSync(path)) unlinkSync(path);
}
