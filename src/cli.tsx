#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { App } from "./App.js";
import type { ToolId } from "../lib/tools.js";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function enterFullscreen() {
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l");
}

function leaveFullscreen() {
  process.stdout.write("\x1b[?25h\x1b[?1049l\x1b[2J\x1b[H");
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const args = process.argv.slice(2).filter((arg) => arg !== "--");
let initialTool: ToolId | undefined;
let initialTarget: string | undefined;

if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
  console.log(`EVRON — passive recon chat for Linux

Usage:
  evron
  evron audit example.com
  evron cves-target example.com
  evron /cve example.com     (same idea via chat)

Chat:
  Press / for categorized commands
  /new  /signout  /help  /export
  /audit /dns /ssl /headers /tech /email
  /subdomains /paths /ip /ports /reputation
  /cve (map CVEs to target stack)  /cve-search (keyword only)

Sessions: ~/.evron/sessions
Exports:  ~/.evron/exports
`);
  process.exit(0);
}

const known: ToolId[] = [
  "audit",
  "dns",
  "ssl",
  "headers",
  "email",
  "tech",
  "subdomains",
  "paths",
  "ip",
  "reputation",
  "ports",
  "breach-email",
  "breach-password",
  "cves-target",
  "cves-keyword",
  "utilities",
  "history",
];

if (args.length >= 1) {
  const candidate = args[0].replace(/^\//, "") as ToolId;
  const aliases: Record<string, ToolId> = {
    cve: "cves-target",
    cves: "cves-target",
    "cve-search": "cves-keyword",
    util: "utilities",
  };
  const mapped = aliases[candidate] ?? candidate;
  if (known.includes(mapped)) {
    initialTool = mapped;
    initialTarget = args[1];
  } else {
    initialTool = "audit";
    initialTarget = args[0];
  }
}

enterFullscreen();

const instance = render(
  <App initialTool={initialTool} initialTarget={initialTarget} />,
  { exitOnCtrlC: true },
);

function shutdown(code = 0) {
  try {
    instance.unmount();
  } catch {
    // ignore
  }
  leaveFullscreen();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => {
  try {
    leaveFullscreen();
  } catch {
    // ignore
  }
});
