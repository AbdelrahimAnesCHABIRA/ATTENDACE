# Deploying AttendQR to Render (Free Tier)

## Prerequisites

- GitHub account (to connect your repo)
- Google Cloud Console access (to update OAuth redirect URIs)

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/attendqr.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create a Render Web Service

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:


| Setting           | Value                  |
| ----------------- | ---------------------- |
| **Name**          | `attendqr`             |
| **Runtime**       | `Node`                 |
| **Build Command** | `npm run render:build` |
| **Start Command** | `npm start`            |
| **Plan**          | `Free`                 |

---

## Step 3: Set Up Turso Database (Free Persistent Storage)

Turso provides a free cloud SQLite database so your data persists permanently across Render deploys.

### Create a Turso account and database:

1. Go to [turso.tech](https://turso.tech) and sign up (free — 9GB storage, 500M reads/month)
2. Install the Turso CLI:
   ```bash
   # macOS/Linux
   curl -sSfL https://get.tur.so/install.sh | bash

   # Windows (PowerShell)
   iwr https://get.tur.so/install.ps1 -useb | iex
   ```
3. Login: `turso auth login`
4. Create database: `turso db create attendqr`
5. Get the URL: `turso db show attendqr --url`
   - Returns something like: `libsql://attendqr-yourusername.turso.io`
6. Create an auth token: `turso db tokens create attendqr`
   - Returns a long JWT token

Save both values for the next step.

---

## Step 4: Set Environment Variables

In Render dashboard → your service → **Environment** tab, add these:


| Variable                   | Value                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `production`                                                                                                                                                                                                                                                                              |
| `NODE_OPTIONS`             | `--openssl-legacy-provider`                                                                                                                                                                                                                                                               |
| `JWT_SECRET`               | *(click Generate — any random string)*                                                                                                                                                                                                                                                   |
| `GOOGLE_CLIENT_ID`         | `592164783674-led5skri5plsd3a7t42dtd4jqhmcfigv.apps.googleusercontent.com`                                                                                                                                                                                                                |
| `GOOGLE_CLIENT_SECRET`     | `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`                                                                                                                                                                                                                                                     |
| `GOOGLE_REDIRECT_URI`      | `https://attendqr-m2ec.onrender.com/api/auth/google/callback`                                                                                                                                                                                                                             |
| `CLIENT_URL`               | `https://attendqr-m2ec.onrender.com`                                                                                                                                                                                                                                                      |
| `DEFAULT_GEOFENCE_RADIUS`  | `100`                                                                                                                                                                                                                                                                                     |
| `QR_CODE_VALIDITY_MINUTES` | `15`                                                                                                                                                                                                                                                                                      |
| `ACADEMIC_YEAR`            | `2025-2026`                                                                                                                                                                                                                                                                               |
| `TURSO_DATABASE_URL`       | `libsql://attendqr-yourusername.turso.io` *(from step 3)*                                                                                                                                                                                                                                 |
| `TURSO_AUTH_TOKEN`         | *(the JWT token from step 3)*                                                                                                                                                                                                                                                             |

> **Important:** These URLs use your actual Render service name `attendqr-m2ec`.

---

## Step 4: Update Google Cloud Console

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=592164783674)
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   ```
   https://attendqr-m2ec.onrender.com/api/auth/google/callback
   ```
4. Under **Authorized JavaScript origins**, add:
   ```
   https://attendqr-m2ec.onrender.com
   ```
5. Click **Save**

### Enable Required APIs (if not already done)

- [Enable Google Drive API](https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=592164783674)
- [Enable Google Sheets API](https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=592164783674)

---

## Step 5: Deploy

Click **Deploy** in Render. The build will:

1. Install all dependencies (root + server + client)
2. Build the React frontend
3. Start the Express server (serves API + static React files)

First deploy takes ~3-5 minutes. The app will be live at:

```
https://attendqr-m2ec.onrender.com
```

---

## Important Notes

### Free Tier Limitations

- **Spin-down**: The server sleeps after 15 minutes of inactivity. First request after sleep takes ~30-60 seconds to cold start.
- **Ephemeral disk**: SQLite database resets on each deploy. This is fine for testing — all data (teachers, sessions, attendance) will be recreated as you use the app.
- **750 hours/month**: Enough for one service running 24/7.

### SQLite + Turso Cloud Sync

The app uses SQLite locally with **Turso cloud sync**. On each deploy:

1. Server starts → syncs from Turso cloud → gets all previous data
2. Runs normally with fast local SQLite reads/writes
3. Periodically syncs changes back to Turso cloud
4. On shutdown, final sync pushes remaining changes

**Data is permanent** — survives Render redeploys, server restarts, and cold starts. Turso free tier gives 9GB storage and 500M reads/month.

### QR Codes & Student Access

Students access the attendance form by scanning QR codes on their phones. They don't need accounts — the QR URL points directly to your Render URL. Make sure the Render URL is accessible from the university network.

---

## Troubleshooting

### Build fails with `better-sqlite3` error

Render's build environment should handle native compilation. If it fails:

- Check that `node` version is ≥18 (set in Render → Settings → Node Version)

### Google OAuth redirects to wrong URL

- Double-check `GOOGLE_REDIRECT_URI` env var matches exactly what's in Google Cloud Console
- Both must use `https://` (not `http://`)

### App shows blank page

- Check Render logs for build errors
- Ensure `NODE_OPTIONS=--openssl-legacy-provider` is set in env vars

### 401 Unauthorized after login

- Check that `JWT_SECRET` is set in Render env vars
- Check that `CLIENT_URL` matches your Render URL exactly (with `https://`)
