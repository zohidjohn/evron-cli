import tls from "node:tls";
import { assertPublicHostname, parseTarget } from "./target.js";

export type TlsResult = {
  target: string;
  valid: boolean;
  protocol: string;
  subject: string;
  issuer: string;
  expires: string;
  validFrom: string;
  fingerprint: string;
  authorizedError?: string;
  altNames: string[];
};

function asString(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) return value.join(", ");
  return value || fallback;
}

export async function lookupTls(rawTarget: string): Promise<TlsResult> {
  const url = parseTarget(rawTarget);
  const hostname = url.hostname;
  await assertPublicHostname(hostname);

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      },
      () => {
        const certificate = socket.getPeerCertificate(true);
        const altNames =
          certificate.subjectaltname
            ?.split(",")
            .map((entry) => entry.replace(/^DNS:/i, "").trim())
            .filter(Boolean) ?? [];
        resolve({
          target: hostname,
          valid: socket.authorized,
          protocol: socket.getProtocol() ?? "Unknown",
          subject: asString(certificate.subject?.CN, hostname),
          issuer: asString(
            certificate.issuer?.O ?? certificate.issuer?.CN,
            "Unknown issuer",
          ),
          expires: certificate.valid_to ?? "Unknown",
          validFrom: certificate.valid_from ?? "Unknown",
          fingerprint: certificate.fingerprint256 || certificate.fingerprint || "",
          authorizedError: socket.authorizationError
            ? String(socket.authorizationError)
            : undefined,
          altNames,
        });
        socket.end();
      },
    );
    socket.on("error", () =>
      resolve({
        target: hostname,
        valid: false,
        protocol: "Unavailable",
        subject: hostname,
        issuer: "Unavailable",
        expires: "Unavailable",
        validFrom: "Unavailable",
        fingerprint: "",
        altNames: [],
      }),
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        target: hostname,
        valid: false,
        protocol: "Timeout",
        subject: hostname,
        issuer: "Unavailable",
        expires: "Unavailable",
        validFrom: "Unavailable",
        fingerprint: "",
        altNames: [],
      });
    });
  });
}
