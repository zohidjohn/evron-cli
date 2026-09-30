/**
 * Multi-operator auth from env.
 *
 * Preferred:
 *   EVRON_OPERATORS=alice:pass1,bob:pass2,carol:pass3
 *
 * Legacy fallback:
 *   EVRON_ACCESS_PASSWORD=shared-password
 *   (any operator id accepted with that password)
 */

export type OperatorAccount = { username: string; password: string };

export function loadOperators(): OperatorAccount[] {
  const raw = process.env.EVRON_OPERATORS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf(":");
        if (index <= 0) return null;
        const username = entry.slice(0, index).trim();
        const password = entry.slice(index + 1).trim();
        if (!username || !password) return null;
        return { username, password };
      })
      .filter((entry): entry is OperatorAccount => Boolean(entry));
  }

  const legacy = process.env.EVRON_ACCESS_PASSWORD?.trim();
  if (legacy) {
    return [{ username: "*", password: legacy }];
  }
  return [];
}

export function authConfigured() {
  return loadOperators().length > 0;
}

export function verifyOperator(
  username: string,
  password: string,
): { ok: true; operator: string } | { ok: false; error: string } {
  const operators = loadOperators();
  if (!operators.length) {
    return { ok: true, operator: username.trim() || "guest" };
  }

  const user = username.trim();
  const pass = password;

  const wildcard = operators.find((entry) => entry.username === "*");
  if (wildcard) {
    if (pass === wildcard.password) {
      return { ok: true, operator: user || "operator" };
    }
    return { ok: false, error: "Invalid access code" };
  }

  const match = operators.find(
    (entry) => entry.username.toLowerCase() === user.toLowerCase(),
  );
  if (!match) return { ok: false, error: "Unknown operator" };
  if (match.password !== pass) return { ok: false, error: "Invalid password" };
  return { ok: true, operator: match.username };
}
