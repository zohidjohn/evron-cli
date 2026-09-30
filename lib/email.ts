import dns from "node:dns/promises";
import { assertPublicHostname, parseTarget, requireDomain } from "./target.js";

const DKIM_SELECTORS = [
  "default",
  "selector1",
  "selector2",
  "google",
  "k1",
  "s1",
  "s2",
  "mail",
  "dkim",
  "smtp",
];

export async function analyzeEmail(rawTarget: string) {
  const url = parseTarget(rawTarget);
  const hostname = url.hostname;
  requireDomain(hostname, "Email security");
  await assertPublicHostname(hostname);

  const [txt, mx] = await Promise.all([
    dns.resolveTxt(hostname).catch(() => [] as string[][]),
    dns
      .resolveMx(hostname)
      .catch(() => [] as { exchange: string; priority: number }[]),
  ]);
  const flatTxt = txt.map((entry) => entry.join(""));
  const spf = flatTxt.filter((entry) => entry.toLowerCase().startsWith("v=spf1"));
  const dmarcRecords = await dns
    .resolveTxt(`_dmarc.${hostname}`)
    .then((rows) => rows.map((row) => row.join("")))
    .catch(() => [] as string[]);
  const dmarc = dmarcRecords.filter((entry) =>
    entry.toLowerCase().startsWith("v=dmarc1"),
  );

  const dkim = [];
  for (const selector of DKIM_SELECTORS) {
    const records = await dns
      .resolveTxt(`${selector}._domainkey.${hostname}`)
      .then((rows) => rows.map((row) => row.join("")))
      .catch(() => [] as string[]);
    if (records.length) {
      dkim.push({
        selector,
        records,
        present: true,
      });
    }
  }

  const gradeParts = [
    spf.length ? 1 : 0,
    dmarc.length ? 1 : 0,
    dkim.length ? 1 : 0,
  ];
  const score = Math.round((gradeParts.reduce((a, b) => a + b, 0) / 3) * 100);

  return {
    target: hostname,
    mx: mx.filter((entry) => entry.exchange),
    spf: {
      present: spf.length > 0,
      records: spf,
    },
    dmarc: {
      present: dmarc.length > 0,
      records: dmarc,
    },
    dkim: {
      present: dkim.length > 0,
      selectors: dkim,
      checked: DKIM_SELECTORS,
    },
    score,
    grade: score >= 90 ? "A" : score >= 66 ? "B" : score >= 33 ? "C" : "F",
  };
}
