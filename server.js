import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'dist')));

let geminiAI = null;
let groqAI = null;

if (process.env.GEMINI_API_KEY) {
  geminiAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

if (process.env.GROQ_API_KEY) {
  groqAI = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const SYSTEM_PROMPT = `You are Agent Pippy, a friendly and knowledgeable AI trading assistant. You help users understand trading concepts, market analysis, investment strategies, and financial topics. You speak in a professional yet approachable manner. You provide educational information but always remind users that trading involves risks and they should do their own research. Never provide specific financial advice or guarantee returns.`;

async function callGemini(prompt, systemPrompt = '') {
  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt || SYSTEM_PROMPT
    },
    contents: prompt
  });
  return response.text || '';
}

async function callGroq(prompt, systemPrompt = '') {
  const response = await groqAI.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    max_tokens: 800
  });
  return response.choices[0]?.message?.content || '';
}

async function chainOfDebate(userQuery) {
  const geminiPrompt = `Analyze this trading question and provide your perspective concisely:\n\nUser Query: ${userQuery}\n\nProvide a clear, focused analysis.`;
  const groqPrompt = `Analyze this trading question and provide your perspective concisely:\n\nUser Query: ${userQuery}\n\nProvide a clear, focused analysis with any alternative viewpoints.`;

  const [geminiPerspective, groqPerspective] = await Promise.all([
    callGemini(geminiPrompt, `${SYSTEM_PROMPT}\n\nYou are AI1 (Gemini) providing the first perspective. Be concise but thorough.`),
    callGroq(groqPrompt, `${SYSTEM_PROMPT}\n\nYou are AI2 (Groq) providing an alternative perspective. Be concise but thorough.`)
  ]);

  const synthesisPrompt = `Synthesize these two AI perspectives into a unified, helpful answer:\n\nUser Query: ${userQuery}\n\nPerspective 1 (Gemini):\n${geminiPerspective}\n\nPerspective 2 (Groq):\n${groqPerspective}\n\nProvide a clear, comprehensive answer combining the best insights from both perspectives.`;
  
  const synthesis = await callGemini(synthesisPrompt, `${SYSTEM_PROMPT}\n\nSynthesize both perspectives into a clear, helpful final answer.`);

  const finalPrompt = `Review and refine this answer for the user:\n\nUser Query: ${userQuery}\n\nDraft Answer:\n${synthesis}\n\nProvide the final polished answer. Be clear, helpful, and actionable.`;
  
  const finalAnswer = await callGroq(finalPrompt, `${SYSTEM_PROMPT}\n\nProvide the final refined answer. Make it clear and user-friendly.`);
  
  return finalAnswer;
}

app.post('/api/chat', async (req, res) => {
  if (!geminiAI || !groqAI) {
    const missing = [];
    if (!geminiAI) missing.push('GEMINI_API_KEY');
    if (!groqAI) missing.push('GROQ_API_KEY');
    return res.status(503).json({ 
      error: `Missing API keys: ${missing.join(', ')}. Please add them to enable the Chain of Debate system.` 
    });
  }

  try {
    const { message } = req.body;
    
    const reply = await chainOfDebate(message);

    res.json({ reply });
  } catch (error) {
    console.error('Chain of Debate error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from Agent Pippy Chain of Debate system' 
    });
  }
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Pippy backend running on port ${PORT}`);
  console.log('Chain of Debate (CoD) - Optimized Multi-AI Architecture');
  if (!geminiAI) console.log('Warning: GEMINI_API_KEY not set');
  if (!groqAI) console.log('Warning: GROQ_API_KEY not set');
  if (geminiAI && groqAI) console.log('Both Gemini and Groq AI ready!');
});
