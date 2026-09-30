import {
  analyzeSecurityHeaders,
  computeExposureScore,
  detectTechnologies,
  type HeaderFinding,
  type TechSignal,
} from "./security.js";
import { assertPublicHostname, isIpHost, parseTarget } from "./target.js";

function explainFetchError(error: unknown, url: string) {
  const err = error as {
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const code = err.cause?.code;
  const detail = err.cause?.message || err.message || "fetch failed";
  if (code === "ECONNREFUSED") {
    return `Connection refused for ${url} (nothing listening on that port)`;
  }
  if (code === "ETIMEDOUT" || detail.includes("TimeoutError") || detail.includes("aborted")) {
    return `Timed out reaching ${url}`;
  }
  if (code === "ENOTFOUND") {
    return `DNS lookup failed for ${url}`;
  }
  if (code === "CERT_HAS_EXPIRED" || detail.toLowerCase().includes("certificate")) {
    return `TLS/certificate problem talking to ${url}: ${detail}`;
  }
  if (code === "EPROTO" || code === "ERR_SSL_WRONG_VERSION_NUMBER") {
    return `TLS handshake failed for ${url} — host may only speak HTTP`;
  }
  return `Could not fetch ${url}: ${detail}${code ? ` (${code})` : ""}`;
}

async function tryFetch(url: URL) {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent": "EVRON-Recon/2.6 (+passive-scan)",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
}

/** Prefer the URL scheme given; for bare hosts/IPs, try HTTPS then HTTP. */
export async function fetchTarget(rawTarget: string) {
  const parsed = parseTarget(rawTarget);
  await assertPublicHostname(parsed.hostname);

  const candidates: URL[] = [];
  const explicitScheme = /^(https?):\/\//i.test(rawTarget.trim());
  if (explicitScheme) {
    candidates.push(parsed);
  } else {
    candidates.push(new URL(`https://${parsed.host}${parsed.pathname}${parsed.search}`));
    candidates.push(new URL(`http://${parsed.host}${parsed.pathname}${parsed.search}`));
  }

  let lastError: unknown;
  let response: Response | null = null;
  let used: URL | null = null;

  for (const candidate of candidates) {
    try {
      response = await tryFetch(candidate);
      used = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response || !used) {
    throw new Error(explainFetchError(lastError, candidates[0].href));
  }

  const interesting = [
    "strict-transport-security",
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "permissions-policy",
    "referrer-policy",
    "server",
    "set-cookie",
    "x-powered-by",
    "x-aspnet-version",
    "via",
  ];
  const headers = Object.fromEntries(
    interesting.map((name) => [name, response.headers.get(name) ?? ""]),
  );

  let bodySnippet = "";
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || contentType.includes("javascript")) {
    bodySnippet = (await response.text().catch(() => "")).slice(0, 140_000);
  }

  const cookies = (headers["set-cookie"] || "")
    .split(/,(?=[^;]+?=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .map((cookie) => {
      const lower = cookie.toLowerCase();
      return {
        raw: cookie.slice(0, 180),
        secure: lower.includes("secure"),
        httpOnly: lower.includes("httponly"),
        sameSite: /samesite=(\w+)/i.exec(cookie)?.[1] ?? "missing",
      };
    });

  return {
    target: parsed.hostname,
    kind: isIpHost(parsed.hostname) ? ("ip" as const) : ("domain" as const),
    finalUrl: response.url || used.href,
    status: response.status,
    headers,
    cookies,
    bodySnippet,
  };
}

export async function analyzeHeaders(rawTarget: string) {
  const fetched = await fetchTarget(rawTarget);
  const findings: HeaderFinding[] = analyzeSecurityHeaders(fetched.headers);
  const score = computeExposureScore({
    headerFindings: findings,
    tlsValid: fetched.finalUrl.startsWith("https:"),
    https: fetched.finalUrl.startsWith("https:"),
    technologyCount: 0,
  });
  return { ...fetched, findings, score, bodySnippet: undefined };
}

export async function analyzeTech(rawTarget: string) {
  const fetched = await fetchTarget(rawTarget);
  const signals: TechSignal[] = detectTechnologies({
    headers: fetched.headers,
    bodySnippet: fetched.bodySnippet,
    server: fetched.headers.server,
    poweredBy: fetched.headers["x-powered-by"],
  });
  return {
    target: fetched.target,
    status: fetched.status,
    finalUrl: fetched.finalUrl,
    signals,
  };
}
