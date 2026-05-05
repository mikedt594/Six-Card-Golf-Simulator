# Six Card Golf Simulator

A static browser version of the Six Card Golf simulator and solver.

## Run locally

From this folder:

```powershell
node serve-local.mjs
```

Then open:

```text
http://localhost:8000
```

To test on a phone, keep the server running and open the computer's local network address from the phone, for example:

```text
http://192.168.1.42:8000
```

The phone and computer must be on the same Wi-Fi network.

If port `8000` is already busy, choose another port:

```powershell
node serve-local.mjs 8080
```

## Share online for free

This app is made from static files, so it can be hosted on free static hosting services such as Netlify, Cloudflare Pages, or GitHub Pages.

### Netlify manual upload

1. Create a free Netlify account.
2. Create a new site using manual deploy or drag-and-drop upload.
3. Upload this project folder.
4. Netlify will give you a public `.netlify.app` link to share.

### Netlify Git deploy

1. Put these files in a GitHub repository.
2. In Netlify, import the repository.
3. Use these settings:

```text
Build command: leave blank
Publish directory: .
```

Every future update pushed to GitHub can redeploy the public site automatically.

## Hosting notes

- Required files: `index.html`, `styles.css`, `engine.js`, `game.js`, and `gto-worker.js`.
- `serve-local.mjs`, `README.md`, and `netlify.toml` are helper files for testing and deployment.
- No backend server or database is required.
- The GTO solver background worker is created from bundled browser code, so it works on static hosts.
- If a browser blocks the background worker, the app falls back to the regular rollout solver.
