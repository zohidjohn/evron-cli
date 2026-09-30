export type ToolId =
  | "audit"
  | "dns"
  | "ssl"
  | "headers"
  | "email"
  | "tech"
  | "subdomains"
  | "paths"
  | "ip"
  | "reputation"
  | "ports"
  | "breach-email"
  | "breach-password"
  | "cves-target"
  | "cves-keyword"
  | "utilities"
  | "history";

export type ToolCategory =
  | "Surface"
  | "Web"
  | "Discovery"
  | "Threat"
  | "Local"
  | "Session";

export type ToolDefinition = {
  id: ToolId;
  slash: string;
  label: string;
  description: string;
  category: ToolCategory;
  /** What to ask the user next in chat */
  ask: string;
  placeholder: string;
};

export const tools: ToolDefinition[] = [
  {
    id: "audit",
    slash: "/audit",
    label: "Full audit",
    description: "Combined DNS, TLS, headers, tech (+ email for domains)",
    category: "Surface",
    ask: "Enter a domain or public IP for the full audit.",
    placeholder: "example.com or 1.1.1.1",
  },
  {
    id: "dns",
    slash: "/dns",
    label: "DNS & RDAP",
    description: "Records / PTR + registrar metadata",
    category: "Surface",
    ask: "Enter a domain or IP for DNS / RDAP lookup.",
    placeholder: "example.com",
  },
  {
    id: "ssl",
    slash: "/ssl",
    label: "SSL / TLS",
    description: "Certificate identity and protocol",
    category: "Surface",
    ask: "Enter a domain or IP to inspect TLS on port 443.",
    placeholder: "example.com",
  },
  {
    id: "ip",
    slash: "/ip",
    label: "IP intelligence",
    description: "Geo, ASN, hosting provider",
    category: "Surface",
    ask: "Enter a domain or IP for geolocation / ASN intel.",
    placeholder: "8.8.8.8",
  },
  {
    id: "headers",
    slash: "/headers",
    label: "Security headers",
    description: "CSP, HSTS, frame options, cookies",
    category: "Web",
    ask: "Enter a domain, URL, or IP to grade security headers.",
    placeholder: "https://example.com",
  },
  {
    id: "tech",
    slash: "/tech",
    label: "Technology map",
    description: "Framework / CMS / server fingerprints",
    category: "Web",
    ask: "Enter a target to fingerprint public stack signals.",
    placeholder: "example.com",
  },
  {
    id: "email",
    slash: "/email",
    label: "Email security",
    description: "SPF / DMARC / DKIM (domains only)",
    category: "Web",
    ask: "Enter a domain to check SPF, DMARC, and DKIM.",
    placeholder: "example.com",
  },
  {
    id: "paths",
    slash: "/paths",
    label: "Path finder",
    description: "robots/sitemap + common web paths",
    category: "Discovery",
    ask: "Enter a domain or IP to discover common web paths.",
    placeholder: "example.com",
  },
  {
    id: "subdomains",
    slash: "/subdomains",
    label: "Subdomain finder",
    description: "crt.sh + DNS wordlist (+ VT)",
    category: "Discovery",
    ask: "Enter a domain (or IP with PTR) to find subdomains.",
    placeholder: "example.com",
  },
  {
    id: "ports",
    slash: "/ports",
    label: "Port intel",
    description: "Shodan / Censys passive host data",
    category: "Discovery",
    ask: "Enter a domain or IP for passive port intel.",
    placeholder: "1.1.1.1",
  },
  {
    id: "reputation",
    slash: "/reputation",
    label: "Reputation",
    description: "VirusTotal / AbuseIPDB / Safe Browsing",
    category: "Threat",
    ask: "Enter a domain or IP for reputation lookups.",
    placeholder: "example.com",
  },
  {
    id: "cves-target",
    slash: "/cve",
    label: "CVE vs target",
    description: "Detect stack, then map NVD CVEs to those products",
    category: "Threat",
    ask: "Enter a domain or IP — I'll fingerprint it, then look up matching CVEs.",
    placeholder: "example.com",
  },
  {
    id: "cves-keyword",
    slash: "/cve-search",
    label: "CVE keyword search",
    description: "Raw NVD keyword lookup (no target mapping)",
    category: "Threat",
    ask: "Enter a product or keyword to search in NVD.",
    placeholder: "openssl / nginx / next.js",
  },
  {
    id: "breach-email",
    slash: "/breach-email",
    label: "Breach · email",
    description: "HIBP email lookup (needs HIBP_API_KEY)",
    category: "Threat",
    ask: "Enter an email address to check for known breaches.",
    placeholder: "user@example.com",
  },
  {
    id: "breach-password",
    slash: "/breach-password",
    label: "Breach · password",
    description: "Pwned Passwords k-anonymity (no key needed)",
    category: "Threat",
    ask: "Enter a password to check (only a SHA-1 prefix is sent).",
    placeholder: "password to test",
  },
  {
    id: "utilities",
    slash: "/util",
    label: "Utilities",
    description: "sha256 | jwt | b64 | url | password strength",
    category: "Local",
    ask: "Enter utility mode then value like: sha256 hello  OR  jwt eyJ...",
    placeholder: "sha256 hello world",
  },
  {
    id: "history",
    slash: "/history",
    label: "Session history",
    description: "List recent saved sessions",
    category: "Session",
    ask: "",
    placeholder: "",
  },
];

export type SlashCommand = {
  slash: string;
  label: string;
  description: string;
  category: ToolCategory | "System";
  toolId?: ToolId;
  system?: "new" | "signout" | "help" | "export";
};

export const systemCommands: SlashCommand[] = [
  {
    slash: "/new",
    label: "New chat",
    description: "Clear the conversation and start fresh",
    category: "System",
    system: "new",
  },
  {
    slash: "/signout",
    label: "Sign out",
    description: "End the operator session",
    category: "System",
    system: "signout",
  },
  {
    slash: "/help",
    label: "Help",
    description: "Show categories and how chat works",
    category: "System",
    system: "help",
  },
  {
    slash: "/export",
    label: "Export last reply",
    description: "Save last assistant report (md|json|pdf)",
    category: "System",
    system: "export",
  },
];

export const slashCatalog: SlashCommand[] = [
  ...systemCommands,
  ...tools.map((tool) => ({
    slash: tool.slash,
    label: tool.label,
    description: tool.description,
    category: tool.category as ToolCategory | "System",
    toolId: tool.id,
  })),
];

export function findTool(id: ToolId) {
  return tools.find((tool) => tool.id === id);
}

export function findSlash(input: string) {
  const token = input.trim().split(/\s+/)[0]?.toLowerCase();
  if (!token?.startsWith("/")) return null;
  return slashCatalog.find((entry) => entry.slash === token) ?? null;
}

export const categoryOrder: Array<ToolCategory | "System"> = [
  "System",
  "Surface",
  "Web",
  "Discovery",
  "Threat",
  "Local",
  "Session",
];
