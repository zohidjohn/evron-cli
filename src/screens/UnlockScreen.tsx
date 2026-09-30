import React, { useState } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import TextInput from "ink-text-input";
import { authConfigured, verifyOperator } from "../../lib/operators.js";
import { theme } from "../theme.js";
import { Frame } from "../layout/Frame.js";

export function UnlockScreen({
  onUnlock,
}: {
  onUnlock: (operator: string) => void;
}) {
  const configured = authConfigured();
  const { isRawModeSupported } = useStdin();
  const [password, setPassword] = useState("");
  const [operator, setOperator] = useState("operator_01");
  const [step, setStep] = useState<"operator" | "password">("operator");
  const [error, setError] = useState("");

  useInput(
    (_input, key) => {
      if (key.escape) process.exit(0);
    },
    { isActive: isRawModeSupported },
  );

  if (!configured) {
    return (
      <Frame title="ACCESS" footer="Enter continue · Esc quit" center>
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
          <Text bold color={theme.cyan}>
            EVRON
          </Text>
          <Text color={theme.amber}>No operators configured</Text>
          <Text color={theme.dim}>
            Set EVRON_OPERATORS in .env.local — or continue as guest
          </Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor={theme.cyan}
          paddingX={1}
          width={48}
        >
          <Text color={theme.muted}>operator&gt; </Text>
          <TextInput
            value={operator}
            onChange={setOperator}
            onSubmit={() => onUnlock(operator.trim() || "guest")}
          />
        </Box>
      </Frame>
    );
  }

  return (
    <Frame title="RESTRICTED ACCESS" footer="Esc quit" center>
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text bold color={theme.cyan}>
          EVRON
        </Text>
        <Text color={theme.muted}>operator sign-in</Text>
        <Text color={theme.dim}>
          Use an account from EVRON_OPERATORS
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor={theme.cyan}
        paddingX={1}
        width={48}
        flexDirection="column"
      >
        {step === "operator" ? (
          <Box>
            <Text color={theme.cyan}>operator&gt; </Text>
            <TextInput
              value={operator}
              onChange={setOperator}
              onSubmit={() => setStep("password")}
            />
          </Box>
        ) : (
          <Box>
            <Text color={theme.cyan}>password&gt; </Text>
            <TextInput
              value={password}
              onChange={setPassword}
              mask="*"
              onSubmit={(value) => {
                const result = verifyOperator(operator, value);
                if (!result.ok) {
                  setError(result.error);
                  setPassword("");
                  return;
                }
                onUnlock(result.operator);
              }}
            />
          </Box>
        )}
      </Box>
      {error ? (
        <Box marginTop={1} justifyContent="center">
          <Text color={theme.red}>{error}</Text>
        </Box>
      ) : (
        <Box marginTop={1} justifyContent="center">
          <Text color={theme.dim}>
            {step === "operator" ? "Enter · next" : "Enter · unlock"}
          </Text>
        </Box>
      )}
    </Frame>
  );
}
