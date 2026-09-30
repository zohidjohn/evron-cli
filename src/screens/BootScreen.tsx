import React, { useEffect, useState } from "react";
import { Box, Text, useStdout } from "ink";
import { theme } from "../theme.js";
import { Frame } from "../layout/Frame.js";

const lines = [
  "EVRON BIOS v2.6.14 // SECURE RECON OS",
  "MEMORY TEST ................. 65536K OK",
  "LOADING PASSIVE MODULES ..... [12/12]",
  "MAPPING TERMINAL FRAMEBUFFER",
  "ESTABLISHING OPERATOR SESSION",
];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(0);
  const [progress, setProgress] = useState(0);
  const { stdout } = useStdout();
  const barWidth = Math.min(48, Math.max(24, (stdout?.columns ?? 80) - 24));

  useEffect(() => {
    const lineTimer = setInterval(() => {
      setVisible((value) => Math.min(value + 1, lines.length));
    }, 260);
    const progressTimer = setInterval(() => {
      setProgress((value) => Math.min(value + 4, 100));
    }, 65);
    const done = setTimeout(onDone, 2400);
    return () => {
      clearInterval(lineTimer);
      clearInterval(progressTimer);
      clearTimeout(done);
    };
  }, [onDone]);

  const filled = Math.round((progress / 100) * barWidth);

  return (
    <Frame
      title="TERMINAL RECON"
      footer="PASSIVE INTELLIGENCE PLATFORM · LINUX TUI"
      center
    >
      <Box flexDirection="column" alignItems="center">
        <Text bold color={theme.cyan}>
          EVRON
        </Text>
        <Text color={theme.dim}>BIOS BOOT</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {lines.map((line, index) => (
          <Text key={line} color={index < visible ? theme.ink : theme.dim}>
            {index < visible ? `› ${line}` : " "}
            {index === lines.length - 1 && visible >= lines.length ? (
              <Text color={theme.green}> OK</Text>
            ) : null}
          </Text>
        ))}
      </Box>
      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color={theme.muted}>
          SYSTEM INITIALIZING <Text color={theme.cyan}>{progress}%</Text>
        </Text>
        <Text color={theme.cyan}>
          [{"█".repeat(filled)}
          <Text color={theme.dim}>{"░".repeat(barWidth - filled)}</Text>]
        </Text>
      </Box>
    </Frame>
  );
}
