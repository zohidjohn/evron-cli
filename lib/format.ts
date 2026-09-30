type Finding = { name: string; value: string; state: string };
type Tech = { name: string; category: string; confidence: number };

function divider(label?: string) {
  if (!label) return "────────────────────────────────────────";
  return `── ${label} ${"─".repeat(Math.max(2, 34 - label.length))}`;
}

function kv(label: string, value: string | number | boolean | null | undefined) {
  const text =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);
  return `${label.padEnd(18)} ${text}`;
}

function badge(state: string) {
  if (state === "pass" || state === "ok" || state === "valid") return "[ OK ]";
  if (state === "fail") return "[FAIL]";
  return "[WARN]";
}

export function formatAudit(result: {
  target: string;
  kind?: "ip" | "domain";
  score: number;
  grade: string;
  dns: {
    records: {
      a: string[];
      aaaa: string[];
      mx: { exchange: string; priority: number }[];
      ns: string[];
      txt: string[];
    };
    ptr?: string[];
    rdap: Record<string, unknown> | null;
  };
  tls: {
    valid: boolean;
    subject: string;
    issuer: string;
    expires: string;
    protocol: string;
  };
  headers: {
    status: number;
    score: { grade: string; score: number; label: string; recommendation: string };
    findings: Finding[];
    cookies: { raw: string; secure: boolean; httpOnly: boolean; sameSite: string }[];
  };
  email: {
    score: number;
    grade: string;
    skipped?: boolean;
    spf: { present: boolean; records: string[] };
    dmarc: { present: boolean; records: string[] };
    dkim: { present: boolean; selectors: { selector: string }[] };
  };
  tech: { signals: Tech[] };
}): string[] {
  const lines = [
    `FULL AUDIT · ${result.target}${result.kind === "ip" ? " (IP)" : ""}`,
    "",
    `  Exposure score     ${result.score}/100`,
    `  Overall grade      ${result.grade}`,
    `  Header grade       ${result.headers.score.grade} (${result.headers.score.score})`,
    `  Email grade        ${result.email.skipped ? "n/a (IP target)" : `${result.email.grade} (${result.email.score})`}`,
    `  TLS trust          ${result.tls.valid ? "authorized" : "needs review"}`,
    "",
    divider("DNS"),
    ...(result.kind === "ip"
      ? [
          kv("PTR", result.dns.ptr?.join(", ") || "none"),
          kv("Address", result.target),
        ]
      : [
          kv("A records", result.dns.records.a.join(", ") || "none"),
          kv("AAAA", result.dns.records.aaaa.join(", ") || "none"),
          kv(
            "MX",
            result.dns.records.mx
              .map((row) => `${row.priority} ${row.exchange}`)
              .join(", ") || "none",
          ),
          kv("NS", result.dns.records.ns.join(", ") || "none"),
        ]),
    "",
    divider("TLS"),
    kv("Subject", result.tls.subject),
    kv("Issuer", result.tls.issuer),
    kv("Expires", result.tls.expires),
    kv("Protocol", result.tls.protocol),
    "",
    divider("SECURITY HEADERS"),
    kv("HTTP status", result.headers.status),
    ...result.headers.findings.map(
      (finding) =>
        `  ${badge(finding.state)}  ${finding.name.padEnd(28)} ${finding.value}`,
    ),
    "",
    divider("EMAIL"),
    ...(result.email.skipped
      ? ["  Skipped for IP targets"]
      : [
          kv("SPF", result.email.spf.present ? "present" : "missing"),
          kv("DMARC", result.email.dmarc.present ? "present" : "missing"),
          kv(
            "DKIM",
            result.email.dkim.present
              ? result.email.dkim.selectors.map((row) => row.selector).join(", ")
              : "no common selectors found",
          ),
        ]),
    "",
    divider("TECHNOLOGY"),
    ...(result.tech.signals.length
      ? result.tech.signals.map(
          (signal) =>
            `  • ${signal.name.padEnd(20)} ${signal.category.padEnd(14)} ${signal.confidence}%`,
        )
      : ["  No public stack signals observed"]),
    "",
    divider("RECOMMENDATION"),
    `  ${result.headers.score.recommendation}`,
  ];
  return lines;
}

export function formatDns(result: {
  target: string;
  kind?: "ip" | "domain";
  addresses: string[];
  ptr?: string[];
  records: {
    a: string[];
    aaaa: string[];
    mx: { exchange: string; priority: number }[];
    ns: string[];
    txt: string[];
    cname: string[];
    soa: unknown;
  };
  rdap: Record<string, unknown> | null;
}): string[] {
  const rdap = result.rdap ?? {};
  if (result.kind === "ip") {
    return [
      `DNS / IP · ${result.target}`,
      "",
      divider("REVERSE DNS (PTR)"),
      ...(result.ptr?.length
        ? result.ptr.map((host) => `  • ${host}`)
        : ["  no PTR records"]),
      "",
      divider("RDAP IP"),
      kv("Handle", String(rdap.handle ?? "—")),
      kv("Name", String(rdap.name ?? "—")),
      kv("Type", String(rdap.type ?? "—")),
      kv("Country", String(rdap.country ?? "—")),
      kv("Range", String(rdap.range ?? "—")),
      kv("Registrant", String(rdap.registrant ?? "—")),
    ];
  }
  return [
    `DNS & RDAP · ${result.target}`,
    "",
    divider("RESOLVED ADDRESSES"),
    ...result.addresses.map((address) => `  • ${address}`),
    "",
    divider("RECORDS"),
    ...result.records.a.map((value) => `  A      ${value}`),
    ...result.records.aaaa.map((value) => `  AAAA   ${value}`),
    ...result.records.mx.map(
      (row) => `  MX     ${String(row.priority).padStart(3)}  ${row.exchange}`,
    ),
    ...result.records.ns.map((value) => `  NS     ${value}`),
    ...result.records.cname.map((value) => `  CNAME  ${value}`),
    ...result.records.txt.map((value) => `  TXT    ${value}`),
    "",
    divider("RDAP / WHOIS"),
    kv("Registrar", String(rdap.registrar ?? "—")),
    kv("Created", String(rdap.created ?? "—")),
    kv("Updated", String(rdap.updated ?? "—")),
    kv("Expires", String(rdap.expires ?? "—")),
    kv(
      "Status",
      Array.isArray(rdap.status) ? rdap.status.join(", ") : String(rdap.status ?? "—"),
    ),
  ];
}

export function formatTls(result: {
  target: string;
  valid: boolean;
  subject: string;
  issuer: string;
  expires: string;
  validFrom: string;
  protocol: string;
  fingerprint: string;
  altNames: string[];
  authorizedError?: string;
}): string[] {
  return [
    `SSL / TLS · ${result.target}`,
    "",
    `  Trust status       ${result.valid ? "VALID" : "REVIEW NEEDED"}`,
    result.authorizedError ? `  Auth error         ${result.authorizedError}` : "",
    "",
    divider("CERTIFICATE"),
    kv("Subject", result.subject),
    kv("Issuer", result.issuer),
    kv("Valid from", result.validFrom),
    kv("Valid until", result.expires),
    kv("Protocol", result.protocol),
    kv("Fingerprint", result.fingerprint || "—"),
    "",
    divider("ALT NAMES"),
    ...(result.altNames.length
      ? result.altNames.map((name) => `  • ${name}`)
      : ["  none listed"]),
  ].filter((line) => line !== "");
}

export function formatHeaders(result: {
  target: string;
  status: number;
  finalUrl: string;
  findings: Finding[];
  cookies: { raw: string; secure: boolean; httpOnly: boolean; sameSite: string }[];
  score: { grade: string; score: number; label: string; recommendation: string };
}): string[] {
  return [
    `SECURITY HEADERS · ${result.target}`,
    "",
    kv("Final URL", result.finalUrl),
    kv("HTTP status", result.status),
    kv("Grade", `${result.score.grade} (${result.score.score}/100)`),
    kv("Posture", result.score.label),
    "",
    divider("HEADER CHECKS"),
    ...result.findings.map(
      (finding) =>
        `  ${badge(finding.state)}  ${finding.name.padEnd(28)} ${finding.value}`,
    ),
    "",
    divider("COOKIES"),
    ...(result.cookies.length
      ? result.cookies.map(
          (cookie) =>
            `  • secure=${cookie.secure ? "yes" : "no"}  httpOnly=${cookie.httpOnly ? "yes" : "no"}  sameSite=${cookie.sameSite}`,
        )
      : ["  No Set-Cookie headers observed"]),
    "",
    divider("NEXT STEP"),
    `  ${result.score.recommendation}`,
  ];
}

export function formatEmail(result: {
  target: string;
  score: number;
  grade: string;
  mx: { exchange: string; priority: number }[];
  spf: { present: boolean; records: string[] };
  dmarc: { present: boolean; records: string[] };
  dkim: { present: boolean; selectors: { selector: string; records: string[] }[] };
}): string[] {
  return [
    `EMAIL SECURITY · ${result.target}`,
    "",
    kv("Grade", `${result.grade} (${result.score}/100)`),
    "",
    divider("MAIL EXCHANGERS"),
    ...(result.mx.length
      ? result.mx.map((row) => `  ${String(row.priority).padStart(3)}  ${row.exchange}`)
      : ["  none"]),
    "",
    divider("SPF"),
    ...(result.spf.present
      ? result.spf.records.map((row) => `  ${row}`)
      : ["  missing"]),
    "",
    divider("DMARC"),
    ...(result.dmarc.present
      ? result.dmarc.records.map((row) => `  ${row}`)
      : ["  missing"]),
    "",
    divider("DKIM SELECTORS"),
    ...(result.dkim.present
      ? result.dkim.selectors.flatMap((row) => [
          `  selector: ${row.selector}`,
          ...row.records.map((record) => `    ${record.slice(0, 90)}`),
        ])
      : ["  no common selectors published"]),
  ];
}

export function formatTech(result: {
  target: string;
  status: number;
  finalUrl: string;
  signals: Tech[];
}): string[] {
  return [
    `TECHNOLOGY MAP · ${result.target}`,
    "",
    kv("Final URL", result.finalUrl),
    kv("HTTP status", result.status),
    kv("Signals", result.signals.length),
    "",
    divider("DETECTED STACK"),
    ...(result.signals.length
      ? result.signals.map(
          (signal) =>
            `  ${String(signal.confidence).padStart(3)}%  ${signal.name.padEnd(22)} ${signal.category}`,
        )
      : ["  No fingerprints found from public headers/HTML"]),
  ];
}

export function formatSubdomains(result: {
  target: string;
  input?: string;
  count: number;
  subdomains: { host: string; sources: string[]; addresses: string[] }[] | string[];
  notes?: string[];
}): string[] {
  const rows = result.subdomains.map((entry) =>
    typeof entry === "string"
      ? { host: entry, sources: [] as string[], addresses: [] as string[] }
      : entry,
  );
  return [
    `SUBDOMAINS · ${result.target}`,
    result.input && result.input !== result.target
      ? `Input              ${result.input}`
      : "",
    "",
    kv("Sources", "crt.sh + DNS wordlist (+ VirusTotal if keyed)"),
    kv("Unique hosts", result.count),
    "",
    divider("HOSTS"),
    ...(rows.length
      ? rows.map((row) => {
          const meta = [
            row.sources.join("+") || "unknown",
            row.addresses.slice(0, 2).join(", "),
          ]
            .filter(Boolean)
            .join(" · ");
          return `  • ${row.host}${meta ? `  (${meta})` : ""}`;
        })
      : ["  none found"]),
    "",
    divider("NOTES"),
    ...(result.notes?.length
      ? result.notes.map((note) => `  • ${note}`)
      : ["  —"]),
  ].filter((line) => line !== undefined);
}

export function formatPaths(result: {
  target: string;
  base: string;
  count: number;
  paths: {
    path: string;
    url: string;
    status: number;
    location: string;
    contentType: string;
    source: string;
  }[];
  notes?: string[];
}): string[] {
  return [
    `PATH FINDER · ${result.target}`,
    "",
    kv("Base", result.base),
    kv("Interesting", result.count),
    "",
    divider("DISCOVERED PATHS"),
    ...(result.paths.length
      ? result.paths.map((row) => {
          const extra = [
            row.location ? `→ ${row.location}` : "",
            row.contentType ? row.contentType.split(";")[0] : "",
            row.source,
          ]
            .filter(Boolean)
            .join(" · ");
          return `  [${row.status}]  ${row.path.padEnd(36)} ${extra}`;
        })
      : ["  none found"]),
    "",
    divider("NOTES"),
    ...(result.notes?.length
      ? result.notes.map((note) => `  • ${note}`)
      : ["  —"]),
  ];
}

export function formatIp(result: {
  target: string;
  addresses: string[];
  intel: Record<string, unknown>;
}): string[] {
  const intel = result.intel;
  return [
    `IP INTELLIGENCE · ${result.target}`,
    "",
    divider("ADDRESSES"),
    ...result.addresses.map((address) => `  • ${address}`),
    "",
    divider("LOOKUP"),
    kv("Query IP", String(intel.query ?? "—")),
    kv("Country", String(intel.country ?? "—")),
    kv("Region", String(intel.regionName ?? "—")),
    kv("City", String(intel.city ?? "—")),
    kv("ISP", String(intel.isp ?? "—")),
    kv("Org", String(intel.org ?? "—")),
    kv("ASN", String(intel.as ?? "—")),
  ];
}

export function formatCves(
  keyword: string,
  rows: { id: string; score: string; summary: string }[],
): string[] {
  return [
    `CVE SEARCH · ${keyword}`,
    "",
    kv("Source", "NVD"),
    kv("Matches", rows.length),
    "",
    divider("RESULTS"),
    ...(rows.length
      ? rows.flatMap((row) => [
          `  ${row.id}   CVSS ${row.score}`,
          `    ${row.summary}`,
          "",
        ])
      : ["  No matches"]),
  ];
}

export function formatCvesForTarget(result: {
  target: string;
  products: string[];
  finalUrl?: string;
  notes?: string[];
  groups: {
    product: string;
    cves: { id: string; score: string; summary: string }[];
    error?: string;
  }[];
}): string[] {
  const lines = [
    `CVE VS TARGET · ${result.target}`,
    "",
    kv("Final URL", result.finalUrl ?? "—"),
    kv("Products", result.products.join(", ") || "none"),
    "",
  ];
  for (const group of result.groups) {
    lines.push(divider(group.product.toUpperCase()));
    if (group.error) {
      lines.push(`  [!] ${group.error}`);
      lines.push("");
      continue;
    }
    if (!group.cves.length) {
      lines.push("  No NVD keyword hits for this product");
      lines.push("");
      continue;
    }
    for (const cve of group.cves.slice(0, 5)) {
      lines.push(`  ${cve.id}   CVSS ${cve.score}`);
      lines.push(`    ${cve.summary.slice(0, 140)}${cve.summary.length > 140 ? "…" : ""}`);
    }
    lines.push("");
  }
  lines.push(divider("NOTES"));
  for (const note of result.notes ?? []) lines.push(`  • ${note}`);
  return lines;
}

export function formatUtility(mode: string, input: string, output: string): string[] {
  return [
    `UTILITIES · ${mode}`,
    "",
    divider("INPUT"),
    `  ${input.slice(0, 200)}${input.length > 200 ? "…" : ""}`,
    "",
    divider("OUTPUT"),
    ...output.split("\n").map((line) => `  ${line}`),
  ];
}

export function formatReputation(result: {
  target: string;
  ip: string;
  virustotal: unknown;
  abuseipdb: unknown;
  safebrowsing: unknown;
  notes: string[];
}): string[] {
  const vt = result.virustotal as {
    stats?: Record<string, number>;
    reputation?: number;
    resource?: string;
  } | null;
  const abuse = result.abuseipdb as {
    abuseConfidenceScore?: number;
    totalReports?: number;
    isp?: string;
    countryCode?: string;
    usageType?: string;
  } | null;
  const gsb = result.safebrowsing as {
    clean?: boolean;
    matches?: unknown[];
  } | null;

  return [
    `REPUTATION · ${result.target}`,
    "",
    kv("Resolved IP", result.ip),
    "",
    divider("VIRUSTOTAL"),
    ...(vt
      ? [
          kv("Resource", String(vt.resource ?? result.target)),
          kv("Reputation", vt.reputation ?? "—"),
          kv(
            "Stats",
            vt.stats
              ? Object.entries(vt.stats)
                  .map(([key, value]) => `${key}=${value}`)
                  .join(" ")
              : "—",
          ),
        ]
      : ["  not available"]),
    "",
    divider("ABUSEIPDB"),
    ...(abuse
      ? [
          kv("Confidence", `${abuse.abuseConfidenceScore ?? 0}%`),
          kv("Reports", abuse.totalReports ?? 0),
          kv("ISP", abuse.isp ?? "—"),
          kv("Country", abuse.countryCode ?? "—"),
          kv("Usage", abuse.usageType ?? "—"),
        ]
      : ["  not available"]),
    "",
    divider("SAFE BROWSING"),
    ...(gsb
      ? [
          kv("Status", gsb.clean ? "clean" : "matches found"),
          kv("Matches", gsb.matches?.length ?? 0),
        ]
      : ["  not available"]),
    "",
    divider("NOTES"),
    ...result.notes.map((note) => `  • ${note}`),
  ];
}

export function formatPorts(result: {
  target: string;
  ip: string;
  shodan: unknown;
  censys: unknown;
  notes: string[];
}): string[] {
  const shodan = result.shodan as {
    org?: string;
    isp?: string;
    os?: string;
    ports?: number[];
    hostnames?: string[];
    vulns?: string[];
    services?: {
      port?: number;
      transport?: string;
      product?: string;
      version?: string;
      banner?: string;
    }[];
  } | null;
  const censys = result.censys as {
    services?: { port?: number; name?: string; transport?: string }[];
  } | null;

  return [
    `PORT INTEL · ${result.target}`,
    "",
    kv("IP", result.ip),
    kv("Mode", "passive API data only (no active scan)"),
    "",
    divider("SHODAN"),
    ...(shodan
      ? [
          kv("Org", shodan.org ?? "—"),
          kv("ISP", shodan.isp ?? "—"),
          kv("OS", shodan.os ?? "—"),
          kv("Ports", (shodan.ports ?? []).join(", ") || "none"),
          kv("Hostnames", (shodan.hostnames ?? []).join(", ") || "none"),
          kv("Vulns", (shodan.vulns ?? []).slice(0, 8).join(", ") || "none listed"),
          "",
          "  Services:",
          ...(shodan.services ?? []).map(
            (service) =>
              `    ${String(service.port).padStart(5)}/${service.transport ?? "?"}  ${(service.product || "unknown").padEnd(16)} ${service.version || ""}  ${service.banner || ""}`,
          ),
        ]
      : ["  not available"]),
    "",
    divider("CENSYS"),
    ...(censys?.services?.length
      ? censys.services.map(
          (service) =>
            `  ${String(service.port).padStart(5)}/${service.transport ?? "?"}  ${service.name ?? "unknown"}`,
        )
      : ["  not available"]),
    "",
    divider("NOTES"),
    ...result.notes.map((note) => `  • ${note}`),
  ];
}

export function formatBreach(result: {
  kind: "email" | "password";
  email?: string;
  breached?: boolean;
  breaches?: { Name?: string; BreachDate?: string; DataClasses?: string[] }[];
  pwned?: boolean;
  count?: number;
  note?: string;
}): string[] {
  if (result.kind === "password") {
    return [
      "BREACH CHECK · PASSWORD",
      "",
      kv("Pwned", result.pwned ? "YES" : "NO"),
      kv("Seen count", result.count ?? 0),
      "",
      divider("PRIVACY"),
      `  ${result.note ?? "k-anonymity check"}`,
    ];
  }
  return [
    `BREACH CHECK · ${result.email}`,
    "",
    kv("Breached", result.breached ? "YES" : "NO"),
    kv("Breaches", result.breaches?.length ?? 0),
    "",
    divider("BREACHES"),
    ...(result.breaches?.length
      ? result.breaches.map(
          (breach) =>
            `  • ${breach.Name ?? "unknown"}  (${breach.BreachDate ?? "n/a"})  ${(breach.DataClasses ?? []).slice(0, 5).join(", ")}`,
        )
      : ["  No breaches found for this address"]),
  ];
}

export function summarize(tool: string, target: string, lines: string[]) {
  const first = lines.find((line) => line.trim() && !line.startsWith("─")) ?? tool;
  return `${tool} · ${target || "local"} · ${first.slice(0, 60)}`;
}
