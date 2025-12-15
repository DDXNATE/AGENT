# Development vs Production Guide

## Why Functions Don't Run in Replit by Default

The serverless functions in `/functions/api/` are written for **Cloudflare Workers** runtime. They use the Cloudflare Pages Functions API:

```javascript
export async function onRequest(context) {
  const { request, env } = context;
  // ...
}
```

This code **cannot run** in a standard Node.js environment. Replit's default workflow only runs Vite (the frontend dev server), which:
- Serves the React frontend on port 5000
- Proxies `/api/*` requests to port 8080

But nothing listens on port 8080 by default, so API calls fail with 404.

---

## How Wrangler Enables Local Development

**Wrangler** is Cloudflare's official CLI tool that emulates the Workers runtime locally.

### Setup Local Functions

1. **Build the frontend first:**
   ```bash
   npm run build
   ```

2. **Start Wrangler dev server:**
   ```bash
   npm run dev:functions
   ```
   This starts Wrangler on port 8080, serving:
   - Static files from `dist/`
   - Serverless functions from `functions/`

3. **Or run both in one command:**
   ```bash
   npm run dev:full
   ```

### Environment Variables for Local Development

Create a `.dev.vars` file in the project root (never commit this):

```
GROQ_API_KEY=your_groq_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
```

Wrangler automatically reads this file and injects the variables into `env`.

---

## How Cloudflare Runs This in Production

When deployed to **Cloudflare Pages**:

1. `npm run build` runs during deployment → produces `dist/`
2. Cloudflare serves `dist/` as static assets (CDN edge)
3. Cloudflare detects `/functions/` directory
4. Each file becomes a serverless function at `/api/<filename>`
5. Environment variables are set in Cloudflare Dashboard

### Deployment Steps

1. Connect GitHub repo to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables in Settings:
   - `GROQ_API_KEY`
   - `ALPHA_VANTAGE_API_KEY`
5. Deploy

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite only (frontend, port 5000) |
| `npm run build` | Build static frontend to `dist/` |
| `npm run dev:functions` | Start Wrangler (functions, port 8080) |
| `npm run dev:full` | Build + start Wrangler |

---

## Testing Functions Locally

### Health Check

```bash
curl http://localhost:8080/api/health
```

Expected response:
```json
{
  "status": "ok",
  "runtime": "cloudflare-workers",
  "functions": ["analyze", "market-data", "news", "chat", "health"]
}
```

### Test with Missing API Keys

If `.dev.vars` is missing or incomplete:
```json
{
  "error": "API key missing",
  "required": ["GROQ_API_KEY", "ALPHA_VANTAGE_API_KEY"]
}
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────┐
│                   DEVELOPMENT                    │
├─────────────────────────────────────────────────┤
│  Vite (port 5000)  ──proxy──>  Wrangler (8080)  │
│      Frontend                   Functions        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                   PRODUCTION                     │
├─────────────────────────────────────────────────┤
│        Cloudflare Pages (CDN Edge)              │
│  ┌──────────────┐      ┌──────────────────┐     │
│  │  Static Site │      │ Workers Functions │     │
│  │   (dist/)    │      │   (/functions)   │     │
│  └──────────────┘      └──────────────────┘     │
└─────────────────────────────────────────────────┘
```
