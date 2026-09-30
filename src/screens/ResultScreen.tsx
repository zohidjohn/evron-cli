import React, { useMemo, useState } from "react";
import { Box, Text, useInput, useStdout, useStdin } from "ink";
import { theme, truncate } from "../theme.js";
import { Frame } from "../layout/Frame.js";

export function ResultScreen({
  title,
  target,
  lines,
  onBack,
  onExport,
  onHistory,
}: {
  title: string;
  target?: string;
  lines: string[];
  onBack: () => void;
  onExport: () => void;
  onHistory: () => void;
}) {
  const { stdout } = useStdout();
  const { isRawModeSupported } = useStdin();
  const rows = stdout?.rows ?? 24;
  const cols = stdout?.columns ?? 80;
  const viewport = Math.max(8, rows - 8);
  const [offset, setOffset] = useState(0);

  const visible = useMemo(
    () => lines.slice(offset, offset + viewport),
    [lines, offset, viewport],
  );

  useInput(
    (input, key) => {
      if (key.escape || input === "q") {
        onBack();
        return;
      }
      if (input === "e") {
        onExport();
        return;
      }
      if (input === "h") {
        onHistory();
        return;
      }
      if (key.downArrow || input === "j") {
        setOffset((value) =>
          Math.min(Math.max(0, lines.length - viewport), value + 1),
        );
      }
      if (key.upArrow || input === "k") {
        setOffset((value) => Math.max(0, value - 1));
      }
      if (key.pageDown) {
        setOffset((value) =>
          Math.min(Math.max(0, lines.length - viewport), value + viewport),
        );
      }
      if (key.pageUp) {
        setOffset((value) => Math.max(0, value - viewport));
      }
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Frame
      title={title.toUpperCase()}
      right={target || "local"}
      footer={`↑↓/jk scroll · e export · h history · Esc/q back · ${offset + 1}-${Math.min(lines.length, offset + viewport)}/${lines.length}`}
    >
      <Box flexDirection="column">
        {visible.map((line, index) => (
          <Text key={`${offset}-${index}`} color={colorFor(line)}>
            {truncate(line, cols - 8)}
          </Text>
        ))}
        {lines.length === 0 ? (
          <Text color={theme.muted}>No output.</Text>
        ) : null}
      </Box>
    </Frame>
  );
}

function colorFor(line: string) {
  if (line.includes("[FAIL]") || line.startsWith("[x]")) return theme.red;
  if (line.includes("[WARN]") || line.startsWith("[!]")) return theme.amber;
  if (line.includes("[ OK ]") || line.startsWith("[+]")) return theme.green;
  if (line.startsWith("──")) return theme.cyan;
  if (
    /^(FULL |DNS |SSL |SECURITY |EMAIL |TECHNOLOGY |SUBDOMAINS |IP |CVE |UTILITIES |OPERATION )/.test(
      line,
    )
  ) {
    return theme.cyan;
  }
  return theme.ink;
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <Frame title="WORKING" footer="Passive collection in progress…">
      <Box marginTop={2} flexDirection="column">
        <Text color={theme.amber}>{label}</Text>
        <Text color={theme.muted}>Please wait while EVRON gathers public signals.</Text>
      </Box>
    </Frame>
  );
}

export function ExportScreen({
  pathHint,
  onPick,
  onCancel,
}: {
  pathHint: string;
  onPick: (format: "md" | "json" | "pdf") => void;
  onCancel: () => void;
}) {
  const { isRawModeSupported } = useStdin();
  useInput(
    (input, key) => {
      if (key.escape) onCancel();
      if (input === "1") onPick("md");
      if (input === "2") onPick("json");
      if (input === "3") onPick("pdf");
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Frame title="EXPORT SESSION" footer="1 md · 2 json · 3 pdf · Esc cancel">
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.ink}>Save this report for later use.</Text>
        <Text color={theme.muted}>Files go to: {pathHint}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color={theme.cyan}>  1  Markdown (.md)</Text>
          <Text color={theme.cyan}>  2  JSON (.json)</Text>
          <Text color={theme.cyan}>  3  PDF (.pdf)</Text>
        </Box>
      </Box>
    </Frame>
  );
}

export function MessageScreen({
  title,
  message,
  onDone,
}: {
  title: string;
  message: string;
  onDone: () => void;
}) {
  const { isRawModeSupported } = useStdin();
  useInput(
    (_input, key) => {
      if (key.escape || key.return) onDone();
    },
    { isActive: isRawModeSupported },
  );
  return (
    <Frame title={title} footer="Enter / Esc continue">
      <Box marginTop={2}>
        <Text color={theme.green}>{message}</Text>
      </Box>
    </Frame>
  );
}
