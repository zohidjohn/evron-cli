#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src", "cli.tsx");
const localTsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

const args = existsSync(localTsx)
  ? [localTsx, entry, ...process.argv.slice(2)]
  : ["--import", "tsx", entry, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
