import { ChatOpenAI } from '@langchain/openai';

// Debug: Check if API key is available
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);

// Initialize the chat model
export const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

export const analyticalModel = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY,
});

// Luke-style persona helper
export const LUKE_PERSONA = `You are Luke, a successful crypto trader and mentor. Your communication style is:
- Casual and friendly, using terms like "brother", "man", "bro"
- Direct and confident
- Focused on understanding the person's situation
- Natural and conversational, not corporate or formal`; 