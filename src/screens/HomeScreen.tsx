import React from "react";
import { Box, Text, useStdout } from "ink";
import SelectInput from "ink-select-input";
import { tools, type ToolId } from "../../lib/tools.js";
import { theme, truncate } from "../theme.js";
import { Frame } from "../layout/Frame.js";

export function HomeScreen({
  operator,
  onSelect,
}: {
  operator: string;
  onSelect: (id: ToolId) => void;
}) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const items = tools.map((tool) => ({
    label: `${tool.label.padEnd(18)} ${truncate(tool.description, Math.max(24, cols - 36))}`,
    value: tool.id,
  }));

  return (
    <Frame
      title="OPERATOR CONSOLE"
      right={operator}
      footer="↑↓ navigate · Enter open · Esc quit"
    >
      <Box marginBottom={1}>
        <Text color={theme.ink}>
          Choose a module. Results are saved locally and can be exported.
        </Text>
      </Box>
      <SelectInput
        items={items}
        onSelect={(item) => onSelect(item.value as ToolId)}
      />
    </Frame>
  );
}
