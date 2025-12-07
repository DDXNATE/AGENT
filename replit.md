# Agent Pippy

## Overview
Agent Pippy is an AI-powered trading assistant using a Chain of Debate (CoD) multi-AI architecture. It combines Gemini and Groq AI models for comprehensive, well-reasoned responses about trading concepts, market analysis, and investment strategies.

## Chain of Debate (CoD) System - Optimized Architecture

### Process Flow:
1. **User Input** → Query received through chat interface
2. **AI1 + AI2 (Parallel)** → Gemini and Groq analyze query simultaneously
3. **Synthesis (Gemini)** → Combines both perspectives into unified analysis
4. **Final Refinement (Groq)** → Polishes and delivers the final answer

This optimized architecture runs AI perspectives in parallel and reduces total steps from 9 to 3, delivering responses in ~15-30 seconds instead of 2 minutes.

## Project Structure
- `server.js` - Express backend with Chain of Debate multi-AI architecture
- `src/App.jsx` - Main React chat component
- `src/App.css` - Ice blue theme styling
- `src/index.css` - Global CSS variables and base styles
- `vite.config.js` - Vite configuration with proxy to backend

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Express.js
- **AI Models**: 
  - Gemini 2.5 Flash (Google)
  - Llama 3.1 8B Instant (Groq) - optimized for speed
- **Theme**: Custom Ice Blue color palette

## Color Palette
- Frost Glow Blue: #4DBBFF
- Neon Sky Blue: #77D4FF
- Misty Light Blue: #D2F2FF
- Frost White: #F3FAFF
- Deep Ice Base: #002B40

## Running the Project
The project uses a concurrent setup:
- Frontend runs on port 5000 (Vite dev server)
- Backend runs on port 3001 (Express API server)

Start with: `npm run dev`

## Environment Variables
- `GEMINI_API_KEY` - Required for Gemini AI (AI1 and AI3)
- `GROQ_API_KEY` - Required for Groq AI (AI2 and AI4)

## API Endpoints
- `POST /api/chat` - Send a message through the Chain of Debate system
  - Body: `{ message: string }`
  - Response: `{ reply: string }` - Consensus answer from 2-cycle debate

## Features
- Chain of Debate multi-AI architecture
- 2-cycle debate process for comprehensive answers
- Real-time AI chat interface
- Typing indicator animation
- Responsive ice blue themed design
- Error handling for API issues
