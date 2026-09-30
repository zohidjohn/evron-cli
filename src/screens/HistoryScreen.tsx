import React, { useMemo, useState } from "react";
import { Box, Text, useInput, useStdin, useStdout } from "ink";
import { listSessions, type SessionRecord } from "../../lib/sessions.js";
import { theme, truncate } from "../theme.js";
import { Frame } from "../layout/Frame.js";

export function HistoryScreen({
  onOpen,
  onBack,
}: {
  onOpen: (session: SessionRecord) => void;
  onBack: () => void;
}) {
  const sessions = useMemo(() => listSessions(), []);
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const viewport = Math.max(8, (stdout?.rows ?? 24) - 9);
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);

  useInput(
    (input, key) => {
      if (key.escape || input === "q") {
        onBack();
        return;
      }
      if (!sessions.length) return;
      if (key.upArrow || input === "k") {
        setIndex((value) => {
          const next = Math.max(0, value - 1);
          setOffset((current) => (next < current ? next : current));
          return next;
        });
      }
      if (key.downArrow || input === "j") {
        setIndex((value) => {
          const next = Math.min(sessions.length - 1, value + 1);
          setOffset((current) =>
            next >= current + viewport ? next - viewport + 1 : current,
          );
          return next;
        });
      }
      if (key.return) onOpen(sessions[index]);
    },
    { isActive: isRawModeSupported },
  );

  const visible = sessions.slice(offset, offset + viewport);

  return (
    <Frame
      title="SESSION HISTORY"
      right={`${sessions.length} saved`}
      footer="↑↓/jk browse · Enter open · Esc/q back"
    >
      {!sessions.length ? (
        <Box marginTop={2}>
          <Text color={theme.muted}>
            No previous searches yet. Run a module and results are saved here.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {visible.map((session, visibleIndex) => {
            const absolute = offset + visibleIndex;
            const active = absolute === index;
            const when = new Date(session.createdAt).toLocaleString();
            return (
              <Text
                key={session.id}
                color={active ? theme.cyan : theme.ink}
                backgroundColor={active ? "#123038" : undefined}
              >
                {active ? "› " : "  "}
                {truncate(
                  `${when}  ${(session.tool as string).padEnd(11)}  ${(session.target || "local").padEnd(22)}  ${session.title}`,
                  (stdout?.columns ?? 80) - 8,
                )}
              </Text>
            );
          })}
        </Box>
      )}
    </Frame>
  );
}
