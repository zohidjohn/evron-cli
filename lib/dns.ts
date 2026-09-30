import dns from "node:dns/promises";
import {
  assertPublicHostname,
  isIpHost,
  parseTarget,
} from "./target.js";

async function lookupIpRdap(ip: string) {
  try {
    const response = await fetch(
      `https://rdap.org/ip/${encodeURIComponent(ip)}`,
      {
        headers: { accept: "application/rdap+json, application/json" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      name?: string;
      type?: string;
      country?: string;
      handle?: string;
      startAddress?: string;
      endAddress?: string;
      entities?: {
        roles?: string[];
        handle?: string;
        vcardArray?: [string, unknown[][]];
      }[];
    };
    const registrant = payload.entities?.find((entity) =>
      entity.roles?.includes("registrant"),
    );
    return {
      kind: "ip",
      handle: payload.handle ?? null,
      name: payload.name ?? null,
      type: payload.type ?? null,
      country: payload.country ?? null,
      range: `${payload.startAddress ?? "?"} — ${payload.endAddress ?? "?"}`,
      registrant:
        (registrant?.vcardArray?.[1]?.find((item) => item?.[0] === "fn")?.[3] as
          | string
          | undefined) ??
        registrant?.handle ??
        null,
    };
  } catch {
    return null;
  }
}

async function lookupDomainRdap(hostname: string) {
  try {
    const response = await fetch(
      `https://rdap.org/domain/${encodeURIComponent(hostname)}`,
      {
        headers: { accept: "application/rdap+json, application/json" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      handle?: string;
      status?: string[];
      entities?: {
        roles?: string[];
        handle?: string;
        vcardArray?: [string, unknown[][]];
      }[];
      events?: { eventAction?: string; eventDate?: string }[];
      nameservers?: { ldhName?: string }[];
    };
    const registrar = payload.entities?.find((entity) =>
      entity.roles?.includes("registrar"),
    );
    const events = payload.events ?? [];
    return {
      kind: "domain",
      handle: payload.handle ?? null,
      status: payload.status ?? [],
      registrar:
        (registrar?.vcardArray?.[1]?.find((item) => item?.[0] === "fn")?.[3] as
          | string
          | undefined) ??
        registrar?.handle ??
        null,
      created:
        events.find((event) =>
          ["registration", "created"].includes(event.eventAction ?? ""),
        )?.eventDate ?? null,
      updated:
        events.find((event) => event.eventAction === "last changed")
          ?.eventDate ?? null,
      expires:
        events.find((event) => event.eventAction === "expiration")
          ?.eventDate ?? null,
      nameservers: (payload.nameservers ?? []).map((entry) => entry.ldhName),
    };
  } catch {
    return null;
  }
}

export async function lookupDns(rawTarget: string) {
  const url = parseTarget(rawTarget);
  const hostname = url.hostname;
  const addresses = await assertPublicHostname(hostname);

  if (isIpHost(hostname)) {
    const ptr = await dns.reverse(hostname).catch(() => [] as string[]);
    const rdap = await lookupIpRdap(hostname);
    return {
      target: hostname,
      kind: "ip" as const,
      addresses,
      ptr,
      records: {
        a: hostname.includes(":") ? [] : [hostname],
        aaaa: hostname.includes(":") ? [hostname] : [],
        mx: [] as { exchange: string; priority: number }[],
        ns: [] as string[],
        txt: [] as string[],
        cname: [] as string[],
        soa: null,
      },
      rdap,
    };
  }

  const [a, aaaa, mx, ns, txt, cname, soa] = await Promise.all([
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolve6(hostname).catch(() => [] as string[]),
    dns
      .resolveMx(hostname)
      .catch(() => [] as { exchange: string; priority: number }[]),
    dns.resolveNs(hostname).catch(() => [] as string[]),
    dns.resolveTxt(hostname).catch(() => [] as string[][]),
    dns.resolveCname(hostname).catch(() => [] as string[]),
    dns.resolveSoa(hostname).catch(() => null),
  ]);

  return {
    target: hostname,
    kind: "domain" as const,
    addresses,
    ptr: [] as string[],
    records: {
      a,
      aaaa,
      mx: mx.filter((entry) => entry.exchange),
      ns,
      txt: txt.map((entry) => entry.join("")).filter(Boolean),
      cname,
      soa,
    },
    rdap: await lookupDomainRdap(hostname),
  };
}
