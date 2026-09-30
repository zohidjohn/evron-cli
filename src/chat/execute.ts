import { lookupDns } from "../../lib/dns.js";
import { analyzeEmail } from "../../lib/email.js";
import { analyzeHeaders, analyzeTech } from "../../lib/http-analysis.js";
import { lookupTls } from "../../lib/tls.js";
import {
  checkBreachEmail,
  checkPwnedPassword,
  cvesForTarget,
  lookupIpIntel,
  lookupPaths,
  lookupPorts,
  lookupReputation,
  lookupSubdomains,
  runAudit,
  runUtility,
  searchCves,
  type UtilityMode,
} from "../../lib/recon.js";
import {
  formatAudit,
  formatBreach,
  formatCves,
  formatCvesForTarget,
  formatDns,
  formatEmail,
  formatHeaders,
  formatIp,
  formatPaths,
  formatPorts,
  formatReputation,
  formatSubdomains,
  formatTech,
  formatTls,
  formatUtility,
} from "../../lib/format.js";
import { listSessions } from "../../lib/sessions.js";
import { findTool, type ToolId } from "../../lib/tools.js";

export async function executeTool(
  id: ToolId,
  value: string,
): Promise<{ title: string; target: string; lines: string[]; data: unknown }> {
  switch (id) {
    case "audit": {
      const result = await runAudit(value);
      return {
        title: "Full audit",
        target: result.target,
        lines: formatAudit(result),
        data: result,
      };
    }
    case "dns": {
      const result = await lookupDns(value);
      return {
        title: "DNS & RDAP",
        target: result.target,
        lines: formatDns(result),
        data: result,
      };
    }
    case "ssl": {
      const result = await lookupTls(value);
      return {
        title: "SSL / TLS",
        target: result.target,
        lines: formatTls(result),
        data: result,
      };
    }
    case "headers": {
      const result = await analyzeHeaders(value);
      return {
        title: "Security headers",
        target: result.target,
        lines: formatHeaders(result),
        data: result,
      };
    }
    case "email": {
      const result = await analyzeEmail(value);
      return {
        title: "Email security",
        target: result.target,
        lines: formatEmail(result),
        data: result,
      };
    }
    case "tech": {
      const result = await analyzeTech(value);
      return {
        title: "Technology map",
        target: result.target,
        lines: formatTech(result),
        data: result,
      };
    }
    case "subdomains": {
      const result = await lookupSubdomains(value);
      return {
        title: "Subdomain finder",
        target: result.target,
        lines: formatSubdomains(result),
        data: result,
      };
    }
    case "paths": {
      const result = await lookupPaths(value);
      return {
        title: "Path finder",
        target: result.target,
        lines: formatPaths(result),
        data: result,
      };
    }
    case "ip": {
      const result = await lookupIpIntel(value);
      return {
        title: "IP intelligence",
        target: result.target,
        lines: formatIp(result),
        data: result,
      };
    }
    case "reputation": {
      const result = await lookupReputation(value);
      return {
        title: "Reputation",
        target: result.target,
        lines: formatReputation(result),
        data: result,
      };
    }
    case "ports": {
      const result = await lookupPorts(value);
      return {
        title: "Port intel",
        target: result.target,
        lines: formatPorts(result),
        data: result,
      };
    }
    case "breach-email": {
      const result = await checkBreachEmail(value);
      return {
        title: "Breach · email",
        target: value,
        lines: formatBreach({ kind: "email", ...result }),
        data: result,
      };
    }
    case "breach-password": {
      const result = await checkPwnedPassword(value);
      return {
        title: "Breach · password",
        target: "password",
        lines: formatBreach({ kind: "password", ...result }),
        data: result,
      };
    }
    case "cves-target": {
      const result = await cvesForTarget(value);
      return {
        title: "CVE vs target",
        target: result.target,
        lines: formatCvesForTarget(result),
        data: result,
      };
    }
    case "cves-keyword": {
      const rows = await searchCves(value);
      return {
        title: "CVE keyword search",
        target: value,
        lines: formatCves(value, rows),
        data: { keyword: value, rows },
      };
    }
    case "utilities": {
      const [modeToken, ...rest] = value.trim().split(/\s+/);
      const mode = modeToken as UtilityMode;
      const allowed: UtilityMode[] = [
        "sha256",
        "b64encode",
        "b64decode",
        "urlencode",
        "urldecode",
        "jwt",
        "password",
      ];
      if (!allowed.includes(mode) || !rest.length) {
        throw new Error(
          "Use: <mode> <value>  e.g. sha256 hello  |  jwt eyJ...  |  password secret",
        );
      }
      const output = await runUtility(mode, rest.join(" "));
      return {
        title: "Utilities",
        target: "local",
        lines: formatUtility(mode, rest.join(" "), output),
        data: { mode, input: rest.join(" "), output },
      };
    }
    case "history": {
      const sessions = listSessions().slice(0, 20);
      return {
        title: "Session history",
        target: "local",
        lines: [
          "SESSION HISTORY",
          "",
          ...(sessions.length
            ? sessions.map(
                (session, index) =>
                  `  ${String(index + 1).padStart(2)}. ${new Date(session.createdAt).toLocaleString()}  ${(session.tool as string).padEnd(12)}  ${session.target || "local"}  · ${session.title}`,
              )
            : ["  No saved sessions yet."]),
          "",
          "Tip: reports auto-save after each successful tool run.",
        ],
        data: { sessions },
      };
    }
    default: {
      const tool = findTool(id);
      throw new Error(`Unknown tool: ${tool?.label ?? id}`);
    }
  }
}
