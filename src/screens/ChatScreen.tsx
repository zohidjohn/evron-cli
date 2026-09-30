import React, { useMemo, useState } from "react";
import { Box, Text, useInput, useStdout, useStdin } from "ink";
import TextInput from "ink-text-input";
import {
  categoryOrder,
  findSlash,
  findTool,
  slashCatalog,
  type ToolId,
} from "../../lib/tools.js";
import { exportSession, type ExportFormat } from "../../lib/export.js";
import { exportsDir, saveSession, type SessionRecord } from "../../lib/sessions.js";
import { executeTool } from "../chat/execute.js";
import { theme, truncate } from "../theme.js";

type Role = "system" | "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  lines?: string[];
};

type Pending =
  | { kind: "tool"; toolId: ToolId }
  | { kind: "export" }
  | null;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function helpLines() {
  const lines = [
    "EVRON chat console",
    "",
    "Press / to open commands. Pick a tool, then answer the follow-up question.",
    "",
  ];
  for (const category of categoryOrder) {
    const items = slashCatalog.filter((entry) => entry.category === category);
    if (!items.length) continue;
    lines.push(`── ${category} ──`);
    for (const item of items) {
      lines.push(`  ${item.slash.padEnd(16)} ${item.label} — ${item.description}`);
    }
    lines.push("");
  }
  return lines;
}

export function ChatScreen({
  operator,
  onSignOut,
  bootstrap,
}: {
  operator: string;
  onSignOut: () => void;
  bootstrap?: { toolId: ToolId; value?: string };
}) {
  const { stdout } = useStdout();
  const { isRawModeSupported } = useStdin();
  const cols = Math.max(60, stdout?.columns ?? 80);
  const rows = Math.max(20, stdout?.rows ?? 24);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: uid(),
      role: "system",
      text: `Welcome, ${operator}. Press / for commands — or type a target after picking a module.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [lastSession, setLastSession] = useState<SessionRecord | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  const empty = messages.length <= 1 && !pending && !busy;

  const filteredSlash = useMemo(() => {
    const q = input.startsWith("/") ? input.slice(1).toLowerCase() : "";
    return slashCatalog.filter((entry) => {
      if (!q) return true;
      return (
        entry.slash.slice(1).startsWith(q) ||
        entry.label.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q)
      );
    });
  }, [input]);

  const transcriptHeight = Math.max(6, rows - (slashOpen ? 14 : 8));
  const flatLines = useMemo(() => {
    const out: { role: Role; text: string }[] = [];
    for (const message of messages) {
      const prefix =
        message.role === "user"
          ? "you › "
          : message.role === "assistant"
            ? "evron › "
            : "sys  › ";
      if (message.lines?.length) {
        out.push({ role: message.role, text: `${prefix}${message.text}` });
        for (const line of message.lines) {
          out.push({ role: message.role, text: `       ${line}` });
        }
      } else {
        out.push({ role: message.role, text: `${prefix}${message.text}` });
      }
      out.push({ role: "system", text: "" });
    }
    return out;
  }, [messages]);

  const maxScroll = Math.max(0, flatLines.length - transcriptHeight);
  const visible = flatLines.slice(
    Math.min(scroll, maxScroll),
    Math.min(scroll, maxScroll) + transcriptHeight,
  );

  function push(message: Omit<ChatMessage, "id">) {
    setMessages((current) => [...current, { ...message, id: uid() }]);
    setScroll(99999);
  }

  function startNewChat() {
    setMessages([
      {
        id: uid(),
        role: "system",
        text: "New chat started. Press / to choose a module.",
      },
    ]);
    setPending(null);
    setInput("");
    setSlashOpen(false);
    setScroll(0);
    setLastSession(null);
  }

  async function runTool(toolId: ToolId, value: string) {
    const tool = findTool(toolId);
    if (!tool) return;
    setBusy(true);
    push({
      role: "assistant",
      text: `Running ${tool.label}…`,
    });
    try {
      const result = await executeTool(toolId, value);
      const session = saveSession({
        tool: toolId,
        target: result.target,
        title: result.title,
        summary: `${result.title} · ${result.target}`,
        lines: result.lines,
        data: result.data,
      });
      setLastSession(session);
      setMessages((current) => {
        const next = [...current];
        // replace last "Running…" bubble
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].role === "assistant" && next[i].text.startsWith("Running ")) {
            next[i] = {
              id: uid(),
              role: "assistant",
              text: result.title,
              lines: result.lines,
            };
            break;
          }
        }
        return next;
      });
      setScroll(99999);
    } catch (error) {
      push({
        role: "assistant",
        text: "Something went wrong",
        lines: [
          error instanceof Error ? error.message : "Unknown error",
          "",
          "Try another target, or /help for commands.",
        ],
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  function activateSlash(entry: (typeof slashCatalog)[number]) {
    setSlashOpen(false);
    setInput("");
    if (entry.system === "new") {
      push({ role: "user", text: "/new" });
      startNewChat();
      return;
    }
    if (entry.system === "signout") {
      push({ role: "user", text: "/signout" });
      onSignOut();
      return;
    }
    if (entry.system === "help") {
      push({ role: "user", text: "/help" });
      push({ role: "assistant", text: "Command reference", lines: helpLines() });
      return;
    }
    if (entry.system === "export") {
      push({ role: "user", text: "/export" });
      if (!lastSession) {
        push({
          role: "assistant",
          text: "Nothing to export yet. Run a module first.",
        });
        return;
      }
      setPending({ kind: "export" });
      push({
        role: "assistant",
        text: "Export format? Reply with md, json, or pdf.",
      });
      return;
    }
    if (entry.toolId) {
      const tool = findTool(entry.toolId);
      if (!tool) return;
      push({ role: "user", text: tool.slash });
      if (tool.id === "history") {
        void runTool("history", "");
        return;
      }
      setPending({ kind: "tool", toolId: tool.id });
      push({
        role: "assistant",
        text: tool.ask || `Provide input for ${tool.label}.`,
      });
    }
  }

  async function submit(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    setInput("");
    setSlashOpen(false);

    if (value.startsWith("/")) {
      const hit = findSlash(value);
      if (!hit) {
        push({ role: "user", text: value });
        push({
          role: "assistant",
          text: `Unknown command ${value.split(/\s+/)[0]}. Press / for the menu.`,
        });
        return;
      }
      // allow `/audit example.com` shortcut
      const rest = value.slice(hit.slash.length).trim();
      if (hit.toolId && rest && hit.toolId !== "history") {
        push({ role: "user", text: value });
        await runTool(hit.toolId, rest);
        return;
      }
      activateSlash(hit);
      return;
    }

    push({ role: "user", text: value });

    if (pending?.kind === "export") {
      const format = value.toLowerCase() as ExportFormat;
      if (!["md", "json", "pdf"].includes(format) || !lastSession) {
        push({
          role: "assistant",
          text: "Please reply with md, json, or pdf.",
        });
        return;
      }
      const path = exportSession(lastSession, format);
      push({
        role: "assistant",
        text: `Exported ${format.toUpperCase()}`,
        lines: [`Saved to ${path}`, `Folder: ${exportsDir()}`],
      });
      setPending(null);
      return;
    }

    if (pending?.kind === "tool") {
      await runTool(pending.toolId, value);
      return;
    }

    push({
      role: "assistant",
      text: "Choose a module first. Press / to open commands (try /audit).",
    });
  }

  React.useEffect(() => {
    setSlashIndex((value) =>
      Math.min(value, Math.max(0, filteredSlash.length - 1)),
    );
  }, [filteredSlash.length]);

  React.useEffect(() => {
    setScroll(maxScroll);
  }, [messages, maxScroll]);

  React.useEffect(() => {
    if (bootstrapped || !bootstrap?.toolId) return;
    setBootstrapped(true);
    const tool = findTool(bootstrap.toolId);
    if (!tool) return;
    if (bootstrap.value) {
      push({ role: "user", text: `${tool.slash} ${bootstrap.value}` });
      void runTool(bootstrap.toolId, bootstrap.value);
    } else if (tool.id === "history") {
      void runTool("history", "");
    } else {
      setPending({ kind: "tool", toolId: tool.id });
      push({ role: "user", text: tool.slash });
      push({ role: "assistant", text: tool.ask });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, bootstrapped]);

  useInput(
    (char, key) => {
      if (key.pageUp) {
        setScroll((value) => Math.max(0, value - transcriptHeight));
        return;
      }
      if (key.pageDown) {
        setScroll((value) => Math.min(maxScroll, value + transcriptHeight));
        return;
      }

      if (slashOpen) {
        if (key.upArrow) {
          setSlashIndex((value) => Math.max(0, value - 1));
          return;
        }
        if (key.downArrow) {
          setSlashIndex((value) =>
            Math.min(Math.max(0, filteredSlash.length - 1), value + 1),
          );
          return;
        }
        if (key.escape) {
          setSlashOpen(false);
          return;
        }
      }
    },
    { isActive: isRawModeSupported },
  );

  const placeholder = pending
    ? pending.kind === "export"
      ? "md | json | pdf"
      : findTool(pending.toolId)?.placeholder || "type your answer"
    : empty
      ? "Press / for commands"
      : "Message EVRON…  (/ for commands)";

  const inputBlock = (
    <Box flexDirection="column" width={Math.min(88, cols - 6)}>
      {slashOpen ? (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={theme.cyan}
          paddingX={1}
          marginBottom={1}
          height={8}
        >
          <Text color={theme.muted}>Commands</Text>
          {filteredSlash.slice(0, 6).map((entry, index) => (
            <Text
              key={entry.slash}
              color={index === slashIndex ? theme.cyan : theme.ink}
              backgroundColor={index === slashIndex ? "#123038" : undefined}
            >
              {index === slashIndex ? "› " : "  "}
              {entry.slash.padEnd(16)} {entry.label}
              <Text color={theme.dim}> · {entry.category}</Text>
            </Text>
          ))}
        </Box>
      ) : null}
      <Box
        borderStyle="round"
        borderColor={busy ? theme.amber : theme.cyan}
        paddingX={1}
      >
        <Text color={theme.cyan}>{busy ? "…" : "›"} </Text>
        <TextInput
          value={input}
          placeholder={placeholder}
          focus={!busy}
          onChange={(next) => {
            setInput(next);
            const open = next.startsWith("/");
            setSlashOpen(open);
            if (open) setSlashIndex(0);
          }}
          onSubmit={(next) => {
            if (slashOpen && filteredSlash[slashIndex] && next.trim() === filteredSlash[slashIndex].slash) {
              activateSlash(filteredSlash[slashIndex]);
              return;
            }
            if (slashOpen && filteredSlash[slashIndex] && next.startsWith("/") && !next.includes(" ")) {
              activateSlash(filteredSlash[slashIndex]);
              return;
            }
            void submit(next);
          }}
        />
      </Box>
      <Text color={theme.dim}>
        / commands · PgUp/PgDn scroll · {operator}
        {pending ? " · waiting for your reply" : ""}
      </Text>
    </Box>
  );

  if (empty) {
    return (
      <Box width={cols} height={rows} flexDirection="column" alignItems="center" justifyContent="space-between" paddingY={2}>
        <Box flexDirection="column" alignItems="center" marginTop={Math.max(1, Math.floor(rows / 5))}>
          <Text bold color={theme.cyan}>
            EVRON
          </Text>
          <Text color={theme.muted}>passive recon chat</Text>
          <Text color={theme.dim}>signed in as {operator}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center" marginBottom={2}>
          {inputBlock}
        </Box>
      </Box>
    );
  }

  return (
    <Box width={cols} height={rows} flexDirection="column" paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={theme.cyan}>EVRON // CHAT</Text>
        <Text color={theme.muted}>{operator}</Text>
      </Box>
      <Text color={theme.dim}>{"─".repeat(Math.min(cols - 4, 72))}</Text>
      <Box flexDirection="column" flexGrow={1} height={transcriptHeight}>
        {visible.map((line, index) => (
          <Text
            key={`${scroll}-${index}`}
            color={
              line.role === "user"
                ? theme.cyan
                : line.role === "assistant"
                  ? theme.ink
                  : theme.dim
            }
          >
            {truncate(line.text, cols - 4)}
          </Text>
        ))}
      </Box>
      <Box justifyContent="center" marginTop={1}>
        {inputBlock}
      </Box>
    </Box>
  );
}
