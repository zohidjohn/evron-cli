# Launchpad PPA (optional — not recommended)

**Prefer [APT.md](APT.md): `scripts/install.sh` or a GitHub Release `.deb`.**

Launchpad GPG import is slow and painful. Only use this if you specifically need a PPA.

Packaging files live in `debian/`. Build/upload scripts are in `scripts/`.

You must do the Launchpad + GPG steps once in the browser / on your machine.
Nobody else can create your PPA for you.

---

## 0) One-time Launchpad setup

1. Create account: https://launchpad.net/+login  
2. Confirm your email on Launchpad.  
3. Sign the Ubuntu Code of Conduct (Launchpad prompts you).  
4. Create a PPA: https://launchpad.net/~/+activate-ppa  
   - Name suggestion: `evron`  
   - Display name: `EVRON`  
5. Note your PPA id: `ppa:YOUR_LAUNCHPAD_NAME/evron`

## 1) One-time GPG key (signing uploads)

```bash
sudo apt update
sudo apt install -y gnupg devscripts debhelper dput rsync

gpg --full-generate-key
# RSA 4096, your real name, SAME email as Launchpad

gpg --list-secret-keys --keyid-format LONG
# copy the key id after rsa4096/

gpg --armor --export YOUR_KEY_ID | less
```

Upload the public key to Ubuntu keyserver / Launchpad:

```bash
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

Then on Launchpad → your account → **OpenPGP keys** → paste fingerprint / import.

Also set shell identity (must match key + Launchpad email):

```bash
echo 'export DEBFULLNAME="Your Name"' >> ~/.bashrc
echo 'export DEBEMAIL="you@example.com"' >> ~/.bashrc
echo 'export PPA=ppa:YOUR_LAUNCHPAD_NAME/evron' >> ~/.bashrc
source ~/.bashrc
```

## 2) Build the source package

From the EVRON repo:

```bash
export DEBFULLNAME="Your Name"
export DEBEMAIL="you@example.com"
export PPA=ppa:YOUR_LAUNCHPAD_NAME/evron
# optional: Ubuntu series (default noble = 24.04)
export PPA_SERIES=noble

bash scripts/build-ppa.sh
```

This vendors production `node_modules` (Launchpad builders cannot `npm install` from the internet) and runs `debuild -S`.

## 3) Upload

```bash
bash scripts/upload-ppa.sh
```

Watch status:

`https://launchpad.net/~YOUR_LAUNCHPAD_NAME/+archive/ubuntu/evron`

First publish can take 10–60 minutes.

## 4) Install (what users run)

```bash
sudo add-apt-repository ppa:YOUR_LAUNCHPAD_NAME/evron
sudo apt update
sudo apt install evron
```

Config: `/etc/evron/env`

## 5) More Ubuntu versions

After noble builds successfully, in the PPA web UI use **Copy packages** to jammy / other series.

Note: EVRON needs **Node.js ≥ 18**. Prefer **Ubuntu 24.04 (noble)+**. Older releases may need a newer Node from elsewhere.

## 6) New releases

1. Bump `"version"` in `package.json`  
2. `bash scripts/build-ppa.sh`  
3. `bash scripts/upload-ppa.sh`  

If Launchpad rejects a re-upload of the same version, bump `PPA_REVISION` (e.g. `export PPA_REVISION=2`).

## Troubleshooting

| Problem | Fix |
|---|---|
| `dput` rejected / unsigned | Create GPG key, attach to Launchpad, rebuild so `.changes` is signed |
| Email mismatch | `DEBEMAIL`, GPG uid, and Launchpad email must match |
| Build fails on Launchpad | Open the build log on the PPA page; usually missing files or permissions |
| `nodejs` dependency | Target noble+; Node 18+ is in those archives |

## Local `.deb` (no PPA)

Still available without Launchpad:

```bash
npm run pack:deb
sudo apt install ./dist/evron_*.deb
```
