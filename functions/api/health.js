export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      runtime: 'cloudflare-workers',
      functions: ['analyze', 'market-data', 'news', 'chat', 'health']
    }),
    { status: 200, headers: corsHeaders }
  );
}
