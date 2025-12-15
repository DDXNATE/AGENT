export async function onRequest(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  if (!env.GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'API key missing', required: ['GROQ_API_KEY'] }),
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { message, instrument, history } = body;

    if (!message || !instrument) {
      return new Response(
        JSON.stringify({ error: 'Message and instrument are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = env.GROQ_API_KEY;
    
    const systemPrompt = `You are Pippy, a professional AI trading analyst specializing in ${instrument}. 
Your role is to provide analytical market insights based on technical and fundamental analysis.
Be concise, professional, and data-driven. Focus on actionable insights.
Never provide specific trading advice or financial recommendations.
Always remind users that trading involves risk.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-5).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0]?.message?.content) {
      return new Response(
        JSON.stringify({
          reply: data.choices[0].message.content
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    throw new Error('Failed to generate response');

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat',
        reply: 'I apologize, but I am unable to process your request at the moment. Please try again.'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
