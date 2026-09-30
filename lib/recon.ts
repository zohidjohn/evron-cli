import { createHash } from "node:crypto";
import { lookupDns } from "./dns.js";
import { analyzeEmail } from "./email.js";
import { analyzeHeaders, analyzeTech } from "./http-analysis.js";
import { lookupTls } from "./tls.js";
import {
  assertPublicHostname,
  isIpHost,
  parseTarget,
} from "./target.js";
import {
  lookupPaths as discoverPaths,
  lookupSubdomains as discoverSubdomains,
} from "./discovery.js";

export async function lookupSubdomains(rawTarget: string) {
  return discoverSubdomains(rawTarget);
}

export async function lookupPaths(rawTarget: string) {
  return discoverPaths(rawTarget);
}

export async function runAudit(rawTarget: string) {
  const url = parseTarget(rawTarget);
  await assertPublicHostname(url.hostname);
  const ip = isIpHost(url.hostname);

  const [dnsResult, tls, headers, tech, email] = await Promise.all([
    lookupDns(rawTarget),
    lookupTls(rawTarget),
    analyzeHeaders(rawTarget),
    analyzeTech(rawTarget),
    ip
      ? Promise.resolve({
          target: url.hostname,
          score: 0,
          grade: "n/a",
          mx: [],
          spf: { present: false, records: [] as string[] },
          dmarc: { present: false, records: [] as string[] },
          dkim: {
            present: false,
            selectors: [] as { selector: string; records: string[] }[],
            checked: [] as string[],
          },
          skipped: true,
        })
      : analyzeEmail(rawTarget),
  ]);

  const scoreParts = [
    headers.score.score,
    tls.valid ? 90 : 45,
    ip ? headers.score.score : email.score,
    tech.signals.length > 0 ? 75 : 50,
  ];
  const score = Math.round(
    scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length,
  );

  return {
    target: url.hostname,
    kind: ip ? ("ip" as const) : ("domain" as const),
    score,
    grade: score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D",
    dns: dnsResult,
    tls,
    headers,
    email,
    tech,
    scannedAt: new Date().toISOString(),
  };
}

export async function lookupIpIntel(rawTarget: string) {
  const url = parseTarget(rawTarget);
  const addresses = await assertPublicHostname(url.hostname);
  const ipv4 =
    addresses.find((address) => !address.includes(":")) ?? addresses[0];
  const response = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ipv4)}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as,query`,
    { signal: AbortSignal.timeout(10000) },
  );
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    country?: string;
    regionName?: string;
    city?: string;
    isp?: string;
    org?: string;
    as?: string;
    query?: string;
  };
  if (payload.status !== "success") {
    throw new Error(payload.message || "IP lookup failed");
  }
  return {
    target: url.hostname,
    addresses,
    intel: payload,
  };
}

export async function lookupReputation(rawTarget: string) {
  const url = parseTarget(rawTarget);
  const addresses = await assertPublicHostname(url.hostname);
  const ip =
    addresses.find((address) => !address.includes(":")) ?? addresses[0];
  const vtKey = process.env.VT_API_KEY?.trim();
  const abuseKey = process.env.ABUSEIPDB_API_KEY?.trim();
  const gsbKey = process.env.GSB_API_KEY?.trim();

  const result: {
    target: string;
    ip: string;
    virustotal: unknown;
    abuseipdb: unknown;
    safebrowsing: unknown;
    notes: string[];
  } = {
    target: url.hostname,
    ip,
    virustotal: null,
    abuseipdb: null,
    safebrowsing: null,
    notes: [],
  };

  if (vtKey) {
    const resource = isIpHost(url.hostname) ? ip : url.hostname;
    const response = await fetch(
      `https://www.virustotal.com/api/v3/${isIpHost(url.hostname) ? "ip_addresses" : "domains"}/${encodeURIComponent(resource)}`,
      {
        headers: { "x-apikey": vtKey, accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) {
      const payload = await response.json();
      const stats =
        payload?.data?.attributes?.last_analysis_stats ??
        payload?.data?.attributes?.total_votes ??
        null;
      result.virustotal = {
        resource,
        stats,
        reputation: payload?.data?.attributes?.reputation ?? null,
      };
    } else {
      result.notes.push(`VirusTotal returned ${response.status}`);
    }
  } else {
    result.notes.push("VT_API_KEY not set — VirusTotal skipped");
  }

  if (abuseKey) {
    const response = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`,
      {
        headers: {
          Key: abuseKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) {
      const payload = await response.json();
      result.abuseipdb = payload?.data ?? payload;
    } else {
      result.notes.push(`AbuseIPDB returned ${response.status}`);
    }
  } else {
    result.notes.push("ABUSEIPDB_API_KEY not set — AbuseIPDB skipped");
  }

  if (gsbKey && !isIpHost(url.hostname)) {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(gsbKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "evron-recon", clientVersion: "0.2" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: url.href }],
          },
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.ok) {
      const payload = await response.json();
      result.safebrowsing = {
        matches: payload.matches ?? [],
        clean: !payload.matches?.length,
      };
    } else {
      result.notes.push(`Safe Browsing returned ${response.status}`);
    }
  } else if (!gsbKey) {
    result.notes.push("GSB_API_KEY not set — Google Safe Browsing skipped");
  }

  return result;
}

export async function lookupPorts(rawTarget: string) {
  const url = parseTarget(rawTarget);
  const addresses = await assertPublicHostname(url.hostname);
  const ip =
    addresses.find((address) => !address.includes(":")) ?? addresses[0];
  const shodanKey = process.env.SHODAN_API_KEY?.trim();
  const censysPat =
    process.env.CENSYS_PAT?.trim() ||
    process.env.CENSYS_API_TOKEN?.trim();
  const censysOrg = process.env.CENSYS_ORG_ID?.trim();
  // Legacy vars kept only so old .env files don't silently look "configured"
  const legacyCensys =
    process.env.CENSYS_API_ID?.trim() && process.env.CENSYS_API_SECRET?.trim();

  const result: {
    target: string;
    ip: string;
    shodan: unknown;
    censys: unknown;
    notes: string[];
  } = {
    target: url.hostname,
    ip,
    shodan: null,
    censys: null,
    notes: [],
  };

  if (shodanKey) {
    const response = await fetch(
      `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(shodanKey)}`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (response.ok) {
      const payload = await response.json();
      result.shodan = {
        ip: payload.ip_str,
        org: payload.org,
        isp: payload.isp,
        os: payload.os,
        ports: payload.ports ?? [],
        hostnames: payload.hostnames ?? [],
        vulns: payload.vulns ?? [],
        services: (payload.data ?? []).slice(0, 12).map(
          (entry: {
            port?: number;
            transport?: string;
            product?: string;
            version?: string;
            data?: string;
          }) => ({
            port: entry.port,
            transport: entry.transport,
            product: entry.product,
            version: entry.version,
            banner: (entry.data ?? "").split("\n")[0]?.slice(0, 120),
          }),
        ),
      };
    } else if (response.status === 404) {
      result.notes.push("Shodan has no recorded data for this IP");
    } else {
      result.notes.push(`Shodan returned ${response.status}`);
    }
  } else {
    result.notes.push("SHODAN_API_KEY not set — Shodan skipped");
  }

  if (censysPat) {
    const headers: Record<string, string> = {
      accept: "application/vnd.censys.api.v3.host.v1+json",
      authorization: `Bearer ${censysPat}`,
    };
    if (censysOrg) headers["X-Organization-ID"] = censysOrg;
    const response = await fetch(
      `https://api.platform.censys.io/v3/global/asset/host/${encodeURIComponent(ip)}`,
      { headers, signal: AbortSignal.timeout(20000) },
    );
    if (response.ok) {
      const payload = await response.json();
      const resource = payload?.result?.resource ?? payload?.result ?? {};
      const services = resource.services ?? [];
      result.censys = {
        ip: resource.ip ?? ip,
        asn: resource.autonomous_system?.asn,
        asName: resource.autonomous_system?.name,
        country: resource.location?.country,
        services: services.slice(0, 12).map(
          (service: {
            port?: number;
            protocol?: string;
            service_name?: string;
            transport_protocol?: string;
          }) => ({
            port: service.port,
            name: service.service_name || service.protocol,
            transport: service.transport_protocol,
          }),
        ),
      };
    } else if (response.status === 404) {
      result.notes.push("Censys has no recorded data for this IP");
    } else {
      result.notes.push(`Censys returned ${response.status}`);
    }
  } else {
    result.notes.push(
      legacyCensys
        ? "Legacy CENSYS_API_ID/SECRET found, but Platform needs CENSYS_PAT (Personal Access Token)"
        : "CENSYS_PAT not set — Censys skipped",
    );
  }

  return result;
}

export async function checkBreachEmail(email: string) {
  const key = process.env.HIBP_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "HIBP_API_KEY is required for email breach lookups. Get one at haveibeenpwned.com/API/Key",
    );
  }
  const response = await fetch(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    {
      headers: {
        "hibp-api-key": key,
        "user-agent": "EVRON-Recon",
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404) {
    return { email, breached: false, breaches: [] as unknown[] };
  }
  if (!response.ok) throw new Error(`HIBP returned ${response.status}`);
  const breaches = await response.json();
  return { email, breached: true, breaches };
}

/** Pwned Passwords k-anonymity — only the SHA-1 prefix leaves this process. */
export async function checkPwnedPassword(password: string) {
  const sha1 = createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "add-padding": "true", "user-agent": "EVRON-Recon" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Pwned Passwords returned ${response.status}`);
  const text = await response.text();
  const match = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${suffix}:`));
  const count = match ? Number(match.split(":")[1] || 0) : 0;
  return {
    pwned: count > 0,
    count,
    note: "Full password never left this machine (k-anonymity).",
  };
}

export async function searchCves(keyword: string) {
  const query = keyword.trim();
  if (query.length < 2) throw new Error("Keyword must be at least 2 characters");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;
  const response = await fetch(
    `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=8`,
    { headers, signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`NVD returned ${response.status}`);
  const payload = (await response.json()) as {
    vulnerabilities?: {
      cve?: {
        id?: string;
        descriptions?: { lang?: string; value?: string }[];
        metrics?: { cvssMetricV31?: { cvssData?: { baseScore?: number } }[] };
      };
    }[];
  };
  return (payload.vulnerabilities ?? []).map((entry) => {
    const cve = entry.cve;
    const score = cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ?? 0;
    return {
      id: cve?.id ?? "UNKNOWN",
      score: score.toFixed(1),
      summary:
        cve?.descriptions?.find((item) => item.lang === "en")?.value ??
        "No description",
    };
  });
}

/** Fingerprint a target, then query NVD for each detected product. */
export async function cvesForTarget(rawTarget: string) {
  const tech = await analyzeTech(rawTarget);
  const skip = new Set([
    "hsts",
    "cloudflare",
    "google analytics",
    "server",
    "react", // too noisy in NVD without version
    "vue.js",
  ]);

  /** Prefer searchable product tokens for NVD keyword queries. */
  function toNvdQuery(name: string): string | null {
    const raw = name.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (skip.has(lower)) return null;

    // nginx/1.18.0 → nginx 1.18.0
    const versioned = /^([a-zA-Z][\w.-]*?)\/([\d.]+)/.exec(raw);
    if (versioned) {
      const product = versioned[1];
      if (skip.has(product.toLowerCase())) return null;
      return `${product} ${versioned[2]}`;
    }

    const map: Record<string, string> = {
      "microsoft-iis": "IIS",
      "asp.net": "ASP.NET",
      "next.js": "Next.js",
      "vue.js": "Vue.js",
      wordpress: "WordPress",
      shopify: "Shopify",
      express: "Express",
      php: "PHP",
      apache: "Apache HTTP Server",
      nginx: "nginx",
    };
    return map[lower] ?? raw;
  }

  const ranked = [...tech.signals].sort((a, b) => b.confidence - a.confidence);
  const products: string[] = [];
  const seen = new Set<string>();
  for (const signal of ranked) {
    const query = toNvdQuery(signal.name);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    products.push(query);
    if (products.length >= 5) break;
  }

  if (!products.length) {
    return {
      target: tech.target,
      products: [] as string[],
      groups: [] as {
        product: string;
        cves: { id: string; score: string; summary: string }[];
      }[],
      notes: [
        "No actionable product fingerprints found to map CVEs against.",
        "Try /tech first, or use /cve-search with a product name.",
      ],
    };
  }

  const groups = [];
  for (const product of products) {
    // Small delay to be kinder to NVD when no API key
    await new Promise((resolve) =>
      setTimeout(resolve, process.env.NVD_API_KEY ? 200 : 700),
    );
    try {
      const cves = await searchCves(product);
      groups.push({ product, cves });
    } catch (error) {
      groups.push({
        product,
        cves: [],
        error: error instanceof Error ? error.message : "lookup failed",
      });
    }
  }

  return {
    target: tech.target,
    products,
    finalUrl: tech.finalUrl,
    signals: tech.signals,
    groups,
    notes: [
      `Fingerprinted ${tech.signals.length} signals · queried NVD for ${products.length} products`,
      "Maps public CVE intel to observed products — does not exploit or verify RCE on your host.",
    ],
  };
}

export type UtilityMode =
  | "sha256"
  | "b64encode"
  | "b64decode"
  | "urlencode"
  | "urldecode"
  | "jwt"
  | "password";

export async function runUtility(mode: UtilityMode, value: string) {
  if (mode === "sha256") {
    return createHash("sha256").update(value).digest("hex");
  }
  if (mode === "b64encode") return Buffer.from(value, "utf8").toString("base64");
  if (mode === "b64decode") return Buffer.from(value, "base64").toString("utf8");
  if (mode === "urlencode") return encodeURIComponent(value);
  if (mode === "urldecode") return decodeURIComponent(value);
  if (mode === "jwt") {
    const parts = value.split(".");
    if (parts.length < 2) throw new Error("Not a JWT (expected header.payload.signature)");
    const decode = (part: string) => {
      const padded = part.replace(/-/g, "+").replace(/_/g, "/");
      const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
      return Buffer.from(padded + pad, "base64").toString("utf8");
    };
    return JSON.stringify(
      {
        header: JSON.parse(decode(parts[0])),
        payload: JSON.parse(decode(parts[1])),
        signature: parts[2] ? "[present]" : "[missing]",
      },
      null,
      2,
    );
  }
  if (mode === "password") {
    const length = value.length;
    const classes = [
      /[a-z]/.test(value),
      /[A-Z]/.test(value),
      /\d/.test(value),
      /[^a-zA-Z0-9]/.test(value),
    ].filter(Boolean).length;
    let score = Math.min(100, length * 4 + classes * 15);
    if (length < 8) score = Math.min(score, 40);
    const pwned = await checkPwnedPassword(value);
    return JSON.stringify(
      {
        length,
        charsetClasses: classes,
        score,
        grade: score >= 80 ? "strong" : score >= 55 ? "moderate" : "weak",
        pwned: pwned.pwned,
        pwnedCount: pwned.count,
        note: pwned.note,
      },
      null,
      2,
    );
  }
  throw new Error(`Unknown utility mode: ${mode}`);
}
