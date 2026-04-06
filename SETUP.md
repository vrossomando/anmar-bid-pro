# Anmar Bid Pro — Build Pipeline Setup

Follow these steps ONE TIME to get the pipeline running.
After that, releasing a new version takes 30 seconds.

---

## Step 1 — Create a GitHub Repository

1. Go to https://github.com and sign in (or create a free account)
2. Click the **+** icon (top right) → **New repository**
3. Name it: `anmar-bid-pro`
4. Set it to **Private** (recommended — keeps your code internal)
5. Leave everything else as default, click **Create repository**

---

## Step 2 — Push the app to GitHub

Open a command prompt, navigate to the `estimator-app` folder, and run:

```
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/anmar-bid-pro.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 3 — Generate the updater signing key

This key signs your updates so the app knows they're authentic.
Run this from inside the `estimator-app` folder:

```
npm run tauri signer generate -- -w tauri-update.key
```

This creates two files:
- `tauri-update.key` — the **private key** (keep this secret, don't commit it)
- `tauri-update.key.pub` — the **public key** (safe to share)

It will also print the public key to the console. Copy it.

---

## Step 4 — Update tauri.conf.json with the public key

Open `src-tauri/tauri.conf.json` and replace:

```
"pubkey": "PLACEHOLDER_PUBKEY"
```

With the public key you just copied (it starts with `dW50cnVzdGVk...`):

```
"pubkey": "dW50cnVzdGVkLXJvbGxpbmcEAAAA..."
```

Then commit and push:
```
git add src-tauri/tauri.conf.json
git commit -m "Add updater public key"
git push
```

---

## Step 5 — Add GitHub Secrets

These secrets let the GitHub Actions workflow sign your installer.

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each one:

| Secret name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of the `tauri-update.key` file (open it in Notepad, copy everything) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you chose when generating the key (if you pressed Enter with no password, leave this blank / don't add it) |

---

## Step 6 — Create your first release

```
git tag v1.0.0
git push origin v1.0.0
```

That's it. Go to your GitHub repo → **Actions** tab and watch the build run.
It takes about 10–15 minutes. When it finishes, the installer appears under **Releases**.

---

## Releasing future updates

Every time you want to push a new version:

1. Make your code changes
2. Update the version number in **two places**:
   - `package.json` → change `"version": "1.0.0"` to `"1.1.0"`
   - `src-tauri/tauri.conf.json` → change `"version": "1.0.0"` to `"1.1.0"`
3. Commit, tag, and push:

```
git add .
git commit -m "Version 1.1.0 - describe what changed"
git tag v1.1.0
git push
git push origin v1.1.0
```

GitHub builds the installer automatically. Users already running the app
will see an "Update Available" popup the next time they open it.

---

## What the update experience looks like for users

- A small popup appears in the bottom-right corner of the app
- It shows the version number and release notes
- They click **Install & Restart**
- The app downloads, updates, and relaunches — takes about 30 seconds
- Their data (jobs, estimates, settings) is completely untouched

---

## Troubleshooting

**Build fails with "PLACEHOLDER_PUBKEY"**
→ You haven't completed Step 4 yet. Generate the key and update tauri.conf.json.

**Build fails with signing error**
→ Check that `TAURI_SIGNING_PRIVATE_KEY` secret is set correctly in GitHub.

**SmartScreen warning when installing**
→ Normal without a paid certificate. Click "More info" → "Run anyway".
→ This only appears on first install of each version, not on updates.

**Users aren't seeing the update prompt**
→ Make sure the version in tauri.conf.json and package.json was actually bumped.
→ The app checks on startup — they need to reopen the app.
