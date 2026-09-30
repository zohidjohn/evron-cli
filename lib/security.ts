export type HeaderFinding = {
  name: string;
  value: string;
  state: "pass" | "warn" | "fail";
};

export type TechSignal = {
  name: string;
  category: string;
  confidence: number;
};

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "permissions-policy",
  "referrer-policy",
] as const;

export function analyzeSecurityHeaders(
  headers: Record<string, string>,
): HeaderFinding[] {
  return SECURITY_HEADERS.map((name) => {
    const value = headers[name] ?? "";
    if (!value) {
      return {
        name,
        value: "missing",
        state: name === "strict-transport-security" ? "fail" : "warn",
      };
    }
    if (
      name === "x-content-type-options" &&
      !value.toLowerCase().includes("nosniff")
    ) {
      return { name, value, state: "warn" };
    }
    return { name, value, state: "pass" };
  });
}

export function detectTechnologies(input: {
  headers: Record<string, string>;
  bodySnippet?: string;
  server?: string | null;
  poweredBy?: string | null;
}): TechSignal[] {
  const signals: TechSignal[] = [];
  const headerBlob = Object.entries(input.headers)
    .map(([key, value]) => `${key}:${value}`)
    .join("\n")
    .toLowerCase();
  const body = (input.bodySnippet ?? "").toLowerCase();
  const server = (input.server ?? input.headers.server ?? "").toLowerCase();
  const poweredBy = (
    input.poweredBy ??
    input.headers["x-powered-by"] ??
    ""
  ).toLowerCase();

  const push = (
    name: string,
    category: string,
    confidence: number,
    matched: boolean,
  ) => {
    if (matched) signals.push({ name, category, confidence });
  };

  push("Cloudflare", "CDN / WAF", 94, /cloudflare|cf-ray|__cf/.test(headerBlob));
  push("nginx", "Web server", 90, server.includes("nginx"));
  push("Apache", "Web server", 88, server.includes("apache"));
  push("Microsoft-IIS", "Web server", 88, server.includes("iis"));
  push("Express", "Runtime", 86, poweredBy.includes("express"));
  push("PHP", "Runtime", 90, poweredBy.includes("php") || /x-powered-by:.*php/.test(headerBlob));
  push("ASP.NET", "Runtime", 88, /asp\.net|x-aspnet/.test(headerBlob));
  push("Next.js", "Framework", 92, /_next\/static|__next/.test(body) || headerBlob.includes("x-nextjs"));
  push("React", "JavaScript", 84, /data-reactroot|__next|react/.test(body));
  push("Vue.js", "JavaScript", 82, /__vue|data-v-/.test(body));
  push("WordPress", "CMS", 91, /wp-content|wordpress/.test(body + headerBlob));
  push("Shopify", "Commerce", 93, /shopify|cdn\.shopify/.test(body + headerBlob));
  push("Google Analytics", "Analytics", 80, /google-analytics|gtag\/js|ga\.js/.test(body));
  push("HSTS", "Security", 100, Boolean(input.headers["strict-transport-security"]));
  if (server && !signals.some((signal) => signal.name.toLowerCase() === server)) {
    signals.push({
      name: input.headers.server || server,
      category: "Server",
      confidence: 95,
    });
  }
  if (poweredBy) {
    signals.push({
      name: input.poweredBy || input.headers["x-powered-by"] || poweredBy,
      category: "Runtime",
      confidence: 93,
    });
  }

  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = signal.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function computeExposureScore(input: {
  headerFindings: HeaderFinding[];
  tlsValid: boolean;
  https: boolean;
  technologyCount: number;
}): { score: number; grade: string; label: string; recommendation: string } {
  let score = 55;
  if (input.https) score += 10;
  if (input.tlsValid) score += 15;
  for (const finding of input.headerFindings) {
    if (finding.state === "pass") score += 5;
    if (finding.state === "warn") score -= 4;
    if (finding.state === "fail") score -= 10;
  }
  score = Math.max(5, Math.min(98, score));
  const missing = input.headerFindings.find((finding) => finding.state !== "pass");
  const grade =
    score >= 90 ? "A" : score >= 80 ? "B+" : score >= 70 ? "B" : score >= 60 ? "C" : "D";
  const label =
    score >= 80 ? "Low exposure" : score >= 65 ? "Moderate exposure" : "Elevated exposure";
  const recommendation = missing
    ? `Review ${missing.name} configuration`
    : input.technologyCount > 0
      ? "Surface looks well hardened. Re-scan after infrastructure changes."
      : "Run a scan to generate header and TLS recommendations.";
  return { score, grade, label, recommendation };
}
