# Backstage Technician Desk — GitHub Pages + host-stored data

This package splits the app into a static frontend for GitHub Pages (`docs/`) and a small Node.js API that runs on your theatre's host computer (`host/`). GitHub Pages publishes only the interface. Handoffs, checklists, settings, and incidents are saved as JSON files on the host computer.

## How the pieces fit together

- **GitHub Pages** serves `docs/index.html`, `docs/styles.css`, and `docs/app.js`.
- **The host computer** runs `host/server.js` and stores data under `host/data/`.
- **Tailscale Serve** provides a private HTTPS URL from authorised devices to the API. Technicians need to be signed into the same Tailscale network.
- The app's **Customize → Shared data host** card connects the browser frontend to the API URL. Each browser needs to set this URL once.

GitHub Pages is static hosting, so it cannot itself write files to your computer. That is why the Node.js API still runs on the host.

## Part A — Publish the website on GitHub Pages

1. Create a GitHub repository. If this repository will be public, remember that the frontend **source code** is public too. Event data is kept outside the published `docs/` folder.
2. Upload/push the contents of this project, keeping the `docs/` and `host/` folders in the repository root.
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select your default branch (commonly `main`), and choose the **`/docs`** folder, then save.
5. Wait for GitHub to publish the page. The address will look like `https://YOUR-USER.github.io/YOUR-REPO/`.

When configuring the host in Part B, the allowed **origin** is just `https://YOUR-USER.github.io` — leave off `YOUR-REPO/`. If you use a custom domain, use that HTTPS origin instead.

## Part B — Run the private API on the host computer

### 1. Install requirements

Install Node.js 18 or newer and Tailscale on the host computer. Install Tailscale on each technician's device too, and make sure the authorised devices are members of the same private tailnet. Do not use Tailscale Funnel or router port forwarding for this setup; use private **Tailscale Serve**.

### 2. Start the host API

Open PowerShell in the `host` folder and run:

```powershell
.\start-for-tailscale.ps1
```

The script asks for your GitHub Pages HTTPS origin and a private password of at least 12 characters. The password is not written into the project files. The server binds only to `127.0.0.1` and the allowed website origin is set for CORS.

If PowerShell prevents running local scripts, you can instead set the environment variables in that terminal and run `node server.js`:

```powershell
$env:HOST = "127.0.0.1"
$env:PORT = "3000"
$env:THEATRE_ALLOWED_ORIGINS = "https://YOUR-USER.github.io"
$env:THEATRE_PASSWORD = "replace-with-your-own-private-12-character-or-longer-password"
node server.js
```

Use your own values; do not paste the example password as-is. Keep this terminal running while the desk is in use.

### 3. Give the host a private HTTPS address

In a **second** PowerShell terminal on the host computer, run:

```powershell
tailscale serve 3000
```

Tailscale displays a private HTTPS address resembling `https://HOSTNAME.YOUR-TAILNET.ts.net`. Share that address only with authorised technicians. The API remains reachable only by devices allowed into your private tailnet.

### 4. Connect the GitHub Pages app to the host

1. Open the published GitHub Pages site from a device signed into your Tailscale network.
2. Select **Customize** in the sidebar.
3. Under **Shared data host**, paste the HTTPS address from `tailscale serve`, without a path (e.g. `https://HOSTNAME.YOUR-TAILNET.ts.net`).
4. Click **Connect / load host** and enter the password you chose in Part B.
5. Confirm the page says **Host connected** / **Saved on host**.

Repeat the one-time URL setup on each technician's browser. The password is held only in that browser tab's session storage.

## Local-only mode

To test the app on just the host computer without GitHub Pages/Tailscale, open PowerShell in `host` and run:

```powershell
node server.js
```

Then open <http://localhost:3000>. The bundled `start-local.bat` does the same thing. This local-only mode does not set an access password and should not be exposed to your network.

## Data files and backups

The host computer stores:

- `host/data/event-state.json` — current event, custom checklist settings, checkmarks, handoffs, and incidents.
- `host/data/backups/` — daily snapshots and automatic archives when starting a different event.

The `.gitignore` rules exclude JSON data and backups. Do not manually add event data or passwords to the GitHub repository. Back up the entire `host/data/` folder to an approved location periodically.

## Important operational notes

- If the browser says **HOST UNAVAILABLE** or **HOST SAVE FAILED**, do not assume changes were shared. Fix the connection and verify **Saved on host**. Export a JSON backup first if there are unsaved edits.
- This version does not push live updates or merge simultaneous edits from several browsers. Refresh to load the newest host record, and avoid editing the same record on two devices at once.
- Keep the Node server and Tailscale Serve running while technicians are working. If the host computer sleeps, shuts down, or loses network access, shared storage will be unavailable.
- CORS permits only the exact website origin you configure in `THEATRE_ALLOWED_ORIGINS`; do not use `*`.
- The GitHub Pages frontend is public by default, but the API and event data are private behind Tailscale access and the server password. Do not expose the API directly to the public internet.
- Urgent hazards must still be communicated over venue radio and official procedures. The app does not send alerts.
