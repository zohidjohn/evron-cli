import net from "node:net";
import dns from "node:dns/promises";

export function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  )
    return true;
  const ipv4 = normalized.replace(/^::ffff:/, "");
  const parts = ipv4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part)))
    return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
  );
}

export function isIpHost(hostname: string) {
  return Boolean(net.isIP(hostname));
}

/** Normalize user input into a URL. Accepts domain, IPv4, IPv6, or full URL. */
export function parseTarget(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("A domain, IP, or URL is required");

  let candidate = trimmed;
  if (!trimmed.includes("://")) {
    if (net.isIP(trimmed) === 6) candidate = `https://[${trimmed}]`;
    else candidate = `https://${trimmed}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid domain, IP, or URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS targets are supported");
  }
  if (!url.hostname) throw new Error("Invalid hostname");
  if (net.isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new Error("Private or local targets are blocked");
  }
  return url;
}

export async function assertPublicHostname(hostname: string) {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Private or local targets are blocked");
    }
    return [hostname];
  }
  const addresses = await dns.lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new Error("Private or local targets are blocked");
  }
  return addresses.map(({ address }) => address);
}

export function requireDomain(hostname: string, feature: string) {
  if (isIpHost(hostname)) {
    throw new Error(
      `${feature} requires a domain name. For IPs use IP intel, reputation, ports, TLS, or headers.`,
    );
  }
}
