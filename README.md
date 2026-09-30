# EVRON — Linux terminal recon

Passive security reconnaissance as a **full-screen terminal UI** for Linux.
Accepts **domains, URLs, and public IPs**.

## Run

```bash
npm install
npm start
```

```bash
./bin/evron.js audit example.com
./bin/evron.js audit 1.1.1.1
./bin/evron.js ip 8.8.8.8
./bin/evron.js reputation 1.1.1.1
```

## Operator logins

Put accounts in `.env.local`:

```bash
EVRON_OPERATORS=alice:pass1,bob:pass2,carol:pass3,dave:pass4,erin:pass5
```

## Where to get API keys

| Env var | Service | Get key |
|---|---|---|
| `NVD_API_KEY` | NVD CVE API | https://nvd.nist.gov/developers/request-an-api-key |
| `VT_API_KEY` | VirusTotal | https://www.virustotal.com/gui/my-apikey |
| `ABUSEIPDB_API_KEY` | AbuseIPDB | https://www.abuseipdb.com/account/api |
| `GSB_API_KEY` | Google Safe Browsing | https://developers.google.com/safe-browsing/v4/get-started |
| `HIBP_API_KEY` | Have I Been Pwned (email) | https://haveibeenpwned.com/API/Key |
| `SHODAN_API_KEY` | Shodan | https://account.shodan.io/ |
| `CENSYS_PAT` | Censys Personal Access Token | https://platform.censys.io → API Access → Create New Token |
| `CENSYS_ORG_ID` | Censys org (optional, paid) | Same API Access page → Current Organization |

Keys live in `.env.local` and are loaded by the CLI at startup (not typed by end users).
Password breach checks use free k-anonymity and need **no** key.

## Modules

| Module | Domain | IP |
|---|---|---|
| Full audit | yes | yes (email skipped) |
| DNS & RDAP | records + whois | PTR + IP RDAP |
| SSL / TLS | yes | yes |
| Headers / Tech | yes | yes |
| Email / Subdomains | yes | no |
| IP intel / Reputation / Ports | yes | yes |
| Breach / CVE / Utilities / History | local tools | — |

## Storage

- Sessions: `~/.evron/sessions/`
- Exports: `~/.evron/exports/` (`.md` / `.json` / `.pdf`)

## Install (no Launchpad)

### A) From this folder (simplest)

```bash
npm install
bash scripts/install.sh
evron
```

### B) Debian package on this machine

```bash
npm run pack:deb
sudo apt install ./dist/evron_*.deb
evron
```

### C) Share with others via GitHub Releases

1. Push the repo to GitHub  
2. `npm run pack:deb`  
3. Create a Release → upload `dist/evron_0.2.0_all.deb`  
4. Friends run:

```bash
curl -LO https://github.com/YOU/Evron/releases/download/v0.2.0/evron_0.2.0_all.deb
sudo apt install ./evron_0.2.0_all.deb
```

Config after install: `/etc/evron/env`
