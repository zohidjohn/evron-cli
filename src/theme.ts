export const theme = {
  bg: "#091012",
  ink: "#dce7e8",
  muted: "#75878a",
  cyan: "#8de9df",
  green: "#9deaa9",
  amber: "#e8bd76",
  red: "#efb0b0",
  dim: "#3b4b4f",
};

export function truncate(value: string, width: number) {
  if (value.length <= width) return value;
  if (width <= 1) return "…";
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}
