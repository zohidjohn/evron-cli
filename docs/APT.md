# Shipping EVRON (without Launchpad)

Forget PPAs. Use one of these.

## 1) Install from the repo (you / friends with the code)

```bash
npm install
bash scripts/install.sh
evron
```

Puts the app in `/usr/local/lib/evron` and a launcher in `/usr/local/bin/evron`.  
Config: `/etc/evron/env`

## 2) Local `.deb`

```bash
npm run pack:deb
sudo apt install ./dist/evron_0.2.0_all.deb
```

## 3) GitHub Releases (best way to share)

1. Create a GitHub repo and push  
2. Build: `npm run pack:deb`  
3. GitHub → Releases → “Draft a new release” → tag `v0.2.0` → upload the `.deb`  
4. Install line for users:

```bash
curl -LO https://github.com/YOU/Evron/releases/download/v0.2.0/evron_0.2.0_all.deb
sudo apt install ./evron_0.2.0_all.deb
```

## 4) npm (optional later)

Publish to npm, then:

```bash
npm install -g evron
```

Requires an npmjs.com account and `npm publish`.

---

Launchpad PPA notes remain in [PPA.md](PPA.md) but are optional and not recommended.
