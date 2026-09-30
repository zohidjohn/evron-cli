import React, { useState } from "react";
import type { ToolId } from "../lib/tools.js";
import { BootScreen } from "./screens/BootScreen.js";
import { UnlockScreen } from "./screens/UnlockScreen.js";
import { ChatScreen } from "./screens/ChatScreen.js";

export function App({
  initialTarget,
  initialTool,
}: {
  initialTarget?: string;
  initialTool?: ToolId;
}) {
  const [phase, setPhase] = useState<"boot" | "unlock" | "chat">("boot");
  const [operator, setOperator] = useState("operator");

  if (phase === "boot") {
    return <BootScreen onDone={() => setPhase("unlock")} />;
  }

  if (phase === "unlock") {
    return (
      <UnlockScreen
        onUnlock={(name) => {
          setOperator(name);
          setPhase("chat");
        }}
      />
    );
  }

  return (
    <ChatScreen
      operator={operator}
      onSignOut={() => setPhase("unlock")}
      bootstrap={
        initialTool
          ? { toolId: initialTool, value: initialTarget }
          : undefined
      }
    />
  );
}
