import dns from "node:dns/promises";
import {
  assertPublicHostname,
  isIpHost,
  parseTarget,
  requireDomain,
} from "./target.js";

const COMMON_SUBDOMAINS = [
  "www",
  "mail",
  "webmail",
  "smtp",
  "pop",
  "imap",
  "ftp",
  "api",
  "dev",
  "staging",
  "stage",
  "test",
  "qa",
  "beta",
  "admin",
  "portal",
  "app",
  "cdn",
  "static",
  "img",
  "images",
  "assets",
  "ns1",
  "ns2",
  "vpn",
  "remote",
  "git",
  "gitlab",
  "github",
  "ci",
  "jenkins",
  "docs",
  "status",
  "monitor",
  "grafana",
  "db",
  "mysql",
  "postgres",
  "redis",
  "shop",
  "store",
  "blog",
  "news",
  "support",
  "help",
  "secure",
  "login",
  "sso",
  "auth",
  "m",
  "mobile",
  "cloud",
  "office",
  "exchange",
  "autodiscover",
];

const COMMON_PATHS = [
  "/",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/.well-known/security.txt",
  "/.well-known/change-password",
  "/.well-known/assetlinks.json",
  "/.well-known/apple-app-site-association",
  "/favicon.ico",
  "/humans.txt",
  "/security.txt",
  "/crossdomain.xml",
  "/clientaccesspolicy.xml",
  "/ads.txt",
  "/app-ads.txt",
  "/manifest.json",
  "/site.webmanifest",
  "/browserconfig.xml",
  "/package.json",
  "/composer.json",
  "/.env",
  "/.git/HEAD",
  "/.git/config",
  "/.svn/entries",
  "/server-status",
  "/server-info",
  "/actuator",
  "/actuator/health",
  "/health",
  "/healthz",
  "/ready",
  "/status",
  "/metrics",
  "/api",
  "/api/v1",
  "/api/v2",
  "/graphql",
  "/swagger",
  "/swagger-ui",
  "/swagger-ui.html",
  "/swagger.json",
  "/openapi.json",
  "/v2/api-docs",
  "/docs",
  "/redoc",
  "/admin",
  "/administrator",
  "/login",
  "/wp-login.php",
  "/wp-admin",
  "/wp-json",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/adminer",
  "/console",
  "/debug",
  "/trace",
  "/config",
  "/backup",
  "/backups",
  "/old",
  "/tmp",
  "/test",
  "/staging",
];

async function fromCrtSh(hostname: string) {
  const response = await fetch(
    `https://crt.sh/?q=${encodeURIComponent(`%.${hostname}`)}&output=json`,
    { signal: AbortSignal.timeout(25000) },
  );
  if (!response.ok) throw new Error(`crt.sh returned ${response.status}`);
  const payload = (await response.json()) as { name_value?: string }[];
  const hosts = new Set<string>();
  for (const row of payload) {
    for (const name of (row.name_value ?? "").split("\n")) {
      const host = name.trim().toLowerCase().replace(/^\*\./, "");
      if (!host) continue;
      if (host === hostname || host.endsWith(`.${hostname}`)) hosts.add(host);
    }
  }
  return [...hosts];
}

async function fromVirusTotal(hostname: string) {
  const key = process.env.VT_API_KEY?.trim();
  if (!key) return { hosts: [] as string[], note: "VT_API_KEY not set" };
  const response = await fetch(
    `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(hostname)}/subdomains?limit=40`,
    {
      headers: { "x-apikey": key, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) {
    return {
      hosts: [] as string[],
      note: `VirusTotal returned ${response.status}`,
    };
  }
  const payload = await response.json();
  const hosts = (payload?.data ?? [])
    .map((row: { id?: string }) => (row.id ?? "").toLowerCase())
    .filter(Boolean);
  return { hosts, note: `VirusTotal returned ${hosts.length}` };
}

async function fromCommonDns(hostname: string) {
  const found: { host: string; addresses: string[] }[] = [];
  const chunkSize = 8;
  for (let i = 0; i < COMMON_SUBDOMAINS.length; i += chunkSize) {
    const chunk = COMMON_SUBDOMAINS.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (prefix) => {
        const host = `${prefix}.${hostname}`;
        try {
          const addresses = await dns.lookup(host, { all: true });
          if (!addresses.length) return null;
          return {
            host,
            addresses: addresses.map((entry) => entry.address),
          };
        } catch {
          return null;
        }
      }),
    );
    for (const row of results) if (row) found.push(row);
  }
  return found;
}

export async function lookupSubdomains(rawTarget: string) {
  const url = parseTarget(rawTarget);
  let hostname = url.hostname;
  const notes: string[] = [];

  if (isIpHost(hostname)) {
    const ptr = await dns.reverse(hostname).catch(() => [] as string[]);
    if (!ptr.length) {
      throw new Error(
        "Subdomain finder needs a domain. This IP has no PTR name to expand from.",
      );
    }
    const candidate = ptr[0].replace(/\.$/, "").toLowerCase();
    const parts = candidate.split(".");
    hostname = parts.length >= 2 ? parts.slice(-2).join(".") : candidate;
    notes.push(`IP ${url.hostname} PTR → ${ptr.join(", ")}`);
    notes.push(`Expanding subdomains for base domain ${hostname}`);
  } else {
    requireDomain(hostname, "Subdomain discovery");
  }

  await assertPublicHostname(hostname);

  const [crtHosts, vt, dnsHits] = await Promise.all([
    fromCrtSh(hostname).catch((error) => {
      notes.push(
        `crt.sh failed: ${error instanceof Error ? error.message : "error"}`,
      );
      return [] as string[];
    }),
    fromVirusTotal(hostname),
    fromCommonDns(hostname),
  ]);
  notes.push(vt.note);
  notes.push(
    `DNS wordlist checked ${COMMON_SUBDOMAINS.length} common prefixes`,
  );

  const map = new Map<string, { sources: string[]; addresses: string[] }>();
  const add = (host: string, source: string, addresses: string[] = []) => {
    const key = host.toLowerCase();
    const current = map.get(key) ?? { sources: [], addresses: [] };
    if (!current.sources.includes(source)) current.sources.push(source);
    for (const address of addresses) {
      if (!current.addresses.includes(address)) current.addresses.push(address);
    }
    map.set(key, current);
  };

  for (const host of crtHosts) add(host, "crt.sh");
  for (const host of vt.hosts) add(host, "virustotal");
  for (const row of dnsHits) add(row.host, "dns-wordlist", row.addresses);

  const subdomains = [...map.entries()]
    .map(([host, meta]) => ({
      host,
      sources: meta.sources,
      addresses: meta.addresses,
    }))
    .sort((a, b) => a.host.localeCompare(b.host));

  return {
    target: hostname,
    input: url.hostname,
    count: subdomains.length,
    subdomains,
    notes,
  };
}

async function probePath(base: URL, path: string) {
  const target = new URL(path, base);
  if (target.hostname !== base.hostname) return null;
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
      headers: {
        "user-agent": "EVRON-Recon/2.6 (+path-discovery)",
        accept: "*/*",
      },
    });
    const interesting =
      response.status < 400 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 405;
    if (!interesting) return null;
    return {
      path,
      url: target.href,
      status: response.status,
      location: response.headers.get("location") ?? "",
      contentType: response.headers.get("content-type") ?? "",
      length: response.headers.get("content-length") ?? "",
    };
  } catch {
    return null;
  }
}

function httpBases(url: URL, rawInput: string) {
  const host = url.host;
  const explicit = /^(https?):\/\//i.test(rawInput.trim());
  if (explicit && url.protocol === "http:") {
    return [new URL(`http://${host}/`)];
  }
  if (explicit && url.protocol === "https:") {
    return [new URL(`https://${host}/`), new URL(`http://${host}/`)];
  }
  return [new URL(`https://${host}/`), new URL(`http://${host}/`)];
}

function parseRobots(text: string) {
  const paths = new Set<string>();
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:allow|disallow)\s*:\s*(\/\S*)/i);
    if (match?.[1]) paths.add(match[1].split("?")[0] || match[1]);
    const sitemap = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (sitemap?.[1]) paths.add(sitemap[1]);
  }
  return [...paths];
}

function parseSitemap(text: string) {
  const paths = new Set<string>();
  const matches = text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi);
  for (const match of matches) {
    try {
      const loc = new URL(match[1].trim());
      paths.add(loc.pathname || "/");
    } catch {
      // ignore
    }
  }
  return [...paths].slice(0, 80);
}

export async function lookupPaths(rawTarget: string) {
  const url = parseTarget(rawTarget);
  await assertPublicHostname(url.hostname);
  const bases = httpBases(url, rawTarget);
  let base = bases[0];
  const notes: string[] = [
    "Lightweight discovery only — small public wordlist, not a full brute force.",
  ];

  let reachable = false;
  for (const candidate of bases) {
    try {
      await fetch(candidate, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "EVRON-Recon/2.6 (+path-discovery)" },
      });
      base = candidate;
      reachable = true;
      break;
    } catch {
      // try next scheme
    }
  }
  if (!reachable) {
    throw new Error(
      `Could not reach ${url.hostname} on HTTPS or HTTP (connection failed/refused/timeout)`,
    );
  }
  notes.push(`Using base ${base.origin}`);

  const found: {
    path: string;
    url: string;
    status: number;
    location: string;
    contentType: string;
    length: string;
    source: string;
  }[] = [];

  const seen = new Set<string>();
  const enqueue = async (path: string, source: string) => {
    const normalized = path.startsWith("http")
      ? new URL(path).pathname
      : path.startsWith("/")
        ? path
        : `/${path}`;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const hit = await probePath(base, normalized);
    if (hit) found.push({ ...hit, source });
  };

  for (const starter of ["/robots.txt", "/sitemap.xml", "/sitemap_index.xml"]) {
    const hit = await probePath(base, starter);
    if (!hit) continue;
    found.push({ ...hit, source: "seed" });
    seen.add(starter);
    if (starter === "/robots.txt" && hit.status >= 200 && hit.status < 400) {
      try {
        const body = await fetch(new URL(starter, base), {
          signal: AbortSignal.timeout(7000),
          headers: { "user-agent": "EVRON-Recon/2.6 (+path-discovery)" },
        }).then((response) => response.text());
        const robotsPaths = parseRobots(body);
        notes.push(`robots.txt listed ${robotsPaths.length} entries`);
        for (const path of robotsPaths.slice(0, 40)) {
          if (path.startsWith("http")) {
            try {
              const sitemapUrl = new URL(path);
              if (sitemapUrl.hostname === base.hostname) {
                const sitemapBody = await fetch(sitemapUrl, {
                  signal: AbortSignal.timeout(10000),
                  headers: {
                    "user-agent": "EVRON-Recon/2.6 (+path-discovery)",
                  },
                }).then((response) => response.text());
                for (const entry of parseSitemap(sitemapBody)) {
                  await enqueue(entry, "sitemap");
                }
              }
            } catch {
              // ignore
            }
          } else {
            await enqueue(path, "robots.txt");
          }
        }
      } catch {
        notes.push("Could not parse robots.txt body");
      }
    }
    if (starter.includes("sitemap") && hit.status >= 200 && hit.status < 400) {
      try {
        const body = await fetch(new URL(starter, base), {
          signal: AbortSignal.timeout(10000),
          headers: { "user-agent": "EVRON-Recon/2.6 (+path-discovery)" },
        }).then((response) => response.text());
        for (const entry of parseSitemap(body)) {
          await enqueue(entry, "sitemap");
        }
      } catch {
        notes.push("Could not parse sitemap body");
      }
    }
  }

  const remaining = COMMON_PATHS.filter((path) => !seen.has(path));
  const chunkSize = 6;
  for (let i = 0; i < remaining.length; i += chunkSize) {
    const chunk = remaining.slice(i, i + chunkSize);
    await Promise.all(chunk.map((path) => enqueue(path, "wordlist")));
  }

  found.sort((a, b) => a.path.localeCompare(b.path));
  notes.push(
    `Probed ${seen.size} paths · ${found.length} interesting responses`,
  );

  return {
    target: url.hostname,
    base: base.origin,
    count: found.length,
    paths: found,
    notes,
  };
}
