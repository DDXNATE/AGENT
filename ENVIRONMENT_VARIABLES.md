# Environment Variables for Agent Pippy

This document describes the required environment variables for deploying Agent Pippy.

## Required Secrets

These must be configured in your Cloudflare Pages dashboard under Settings > Environment Variables:

### GROQ_API_KEY
- **Description**: API key for Groq AI services (used for market analysis and chat)
- **How to get**: Sign up at https://console.groq.com and create an API key
- **Required**: Yes

### ALPHA_VANTAGE_API_KEY
- **Description**: API key for Alpha Vantage market data services
- **How to get**: Sign up at https://www.alphavantage.co/support/#api-key (free tier available)
- **Required**: Yes

## Supabase Configuration (Already configured in code)

The following are configured in the frontend code for authentication:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Deployment Steps

### Cloudflare Pages Deployment

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables in the dashboard:
   - `GROQ_API_KEY`: Your Groq API key
   - `ALPHA_VANTAGE_API_KEY`: Your Alpha Vantage API key
5. Deploy

### Local Development

For local development with Wrangler:

```bash
# Create a .dev.vars file (not committed to git)
echo "GROQ_API_KEY=your_groq_key_here" > .dev.vars
echo "ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here" >> .dev.vars

# Run the functions locally
npx wrangler pages dev dist --binding GROQ_API_KEY=your_key ALPHA_VANTAGE_API_KEY=your_key
```

## API Rate Limits

- **Alpha Vantage Free Tier**: 25 requests per day
- **Groq Free Tier**: Check current limits at https://console.groq.com

For production use, consider upgrading to paid tiers for higher rate limits.
