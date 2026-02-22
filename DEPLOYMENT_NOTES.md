# Deployment Notes - WCAG Crawler

## Current Status

- **Frontend (Vercel)**: Deployed at wcag.thegridbase.com
- **Backend (Railway)**: BUILD FAILED - Needs manual fix

## What Was Done

1. Updated API to use `VITE_API_URL` environment variable
2. Added `VITE_SOCKET_URL` for WebSocket connection
3. Created `Dockerfile` and `nixpacks.toml` for server deployment
4. Created `render.yaml` for Render.com Blueprint deployment
5. Updated README with deployment instructions
6. Pushed all changes to GitHub

## What You Need To Do

### Option 1: Fix Railway (If you want to keep using Railway)

1. Go to [Railway Dashboard](https://railway.app/project/f8a9f954-8691-42c3-acc5-cb2c51e6a71e)
2. Click on the "server" service
3. Go to "Deployments" tab
4. Click "Redeploy" on the failed deployment
5. If it fails again, check "Logs" to see the error
6. You might need to delete the service and create a new one

### Option 2: Use Render Instead (Recommended - Easier Setup)

1. Go to [Render.com](https://render.com)
2. Sign in with GitHub
3. Click "New" → "Blueprint"
4. Connect `cankilic-gh/wcag-crawler` repository
5. Render will auto-detect `render.yaml`
6. Click "Apply" to deploy
7. Wait for deployment (may take 10-15 minutes with Playwright)
8. Copy the URL (e.g., `https://wcag-crawler-server.onrender.com`)

### After Backend is Deployed

1. Go to [Vercel Dashboard](https://vercel.com) → wcag-crawler project
2. Settings → Environment Variables
3. Add these variables:
   - `VITE_API_URL` = `https://YOUR-BACKEND-URL` (Railway or Render URL)
   - `VITE_SOCKET_URL` = `https://YOUR-BACKEND-URL` (same URL)
4. Go to Deployments → Redeploy the latest deployment
5. Test at https://wcag.thegridbase.com

## Verification

After everything is deployed, test:

```bash
# Check backend health
curl https://YOUR-BACKEND-URL/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### "Application not found" on Railway
- The service failed to build or is not running
- Go to Railway → Deployments → check logs for errors
- Try deleting the service and creating a new one

### "Failed to start scan" on frontend
- Backend is not reachable
- Check that VITE_API_URL is set correctly in Vercel
- Verify backend is running with the health check above

### Build fails with "better-sqlite3" error
- Native modules need build tools (python3, make, g++)
- The Dockerfile includes these, but nixpacks might not
- Try using Docker build instead of nixpacks

## Files Created/Modified

- `packages/server/Dockerfile` - Docker build for server
- `packages/server/nixpacks.toml` - Nixpacks config for Railway
- `packages/client/src/lib/api.ts` - Dynamic API URL
- `render.yaml` - Render.com Blueprint config
- `README.md` - Updated deployment instructions
