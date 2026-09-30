import React from "react";
import { Box, Text, useStdout } from "ink";
import { theme } from "../theme.js";

export function Frame({
  title,
  right,
  footer,
  center = false,
  children,
}: {
  title: string;
  right?: string;
  footer?: string;
  /** Vertically + horizontally center the main content */
  center?: boolean;
  children: React.ReactNode;
}) {
  const { stdout } = useStdout();
  const cols = Math.max(60, stdout?.columns ?? 80);
  const rows = Math.max(20, stdout?.rows ?? 24);
  const innerWidth = Math.max(40, cols - 6);

  return (
    <Box
      width={cols}
      height={rows}
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.cyan}
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="space-between" width={cols - 4}>
        <Text bold color={theme.cyan}>
          EVRON // {title}
        </Text>
        <Text color={theme.muted}>{right ?? ""}</Text>
      </Box>
      <Text color={theme.dim}>{"─".repeat(Math.max(20, cols - 6))}</Text>
      <Box
        flexDirection="column"
        flexGrow={1}
        width={cols - 4}
        alignItems={center ? "center" : "flex-start"}
        justifyContent={center ? "center" : "flex-start"}
      >
        {center ? (
          <Box flexDirection="column" width={Math.min(64, innerWidth)}>
            {children}
          </Box>
        ) : (
          children
        )}
      </Box>
      {footer ? (
        <Box justifyContent={center ? "center" : "flex-start"}>
          <Text color={theme.dim}>
            {footer.slice(0, Math.max(20, cols - 6))}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
