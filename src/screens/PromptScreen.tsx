import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../theme.js";
import { Frame } from "../layout/Frame.js";

export function PromptScreen({
  title,
  label,
  initial = "",
  placeholder = "",
  onSubmit,
  onCancel,
}: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const { isRawModeSupported } = useStdin();

  useInput(
    (_input, key) => {
      if (key.escape) onCancel();
    },
    { isActive: isRawModeSupported },
  );

  return (
    <Frame title={title.toUpperCase()} footer="Enter confirm · Esc cancel">
      <Box marginTop={1}>
        <Text color={theme.cyan}>{label} </Text>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChange={setValue}
          onSubmit={(next) => {
            if (!next.trim()) return;
            onSubmit(next.trim());
          }}
        />
      </Box>
      <Text color={theme.muted}>{placeholder}</Text>
    </Frame>
  );
}
