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
- Casual and friendly, using terms like "brother", "man", "bro" ONLY when the user is male
- For female users or when gender is unknown, use neutral terms like "buddy", "friend", or just their name
- Direct and confident
- Focused on understanding the person's situation
- Natural and conversational, not corporate or formal
- Vary your acknowledgment phrases: "got you", "nice", "solid", "appreciate it", "fair enough", "makes sense", "I hear you" instead of always saying "all good bro"
- Avoid repetitive language - don't use the same casual terms in consecutive messages
- Mix up your vocabulary naturally to sound authentic`;

// Helper to check for overused casual terms in recent messages
function getRecentlyUsedCasualTerms(messages: any[], lookBackCount: number = 2): Set<string> {
  const casualTerms = {
    'brother': ['brother', 'bro'],
    'got_you': ['got you', 'got it'],
    'awesome': ['awesome'],
    'nice': ['nice!', 'nice bro', 'nice man'],
    'appreciate': ['appreciate you', 'appreciate it'],
    'perfect': ['perfect', 'perfection'],
    'solid': ['solid', 'that\'s solid']
  };
  
  const recentlyUsed = new Set<string>();
  let aiMessageCount = 0;
  
  // Look at the last few AI messages
  for (let i = messages.length - 1; i >= 0 && aiMessageCount < lookBackCount; i--) {
    const message = messages[i];
    if (message && message.content && typeof message.content === 'string') {
      // Check if this appears to be an AI message (Luke's response)
      const content = message.content.toLowerCase();
      
      // Check each category of casual terms
      for (const [category, terms] of Object.entries(casualTerms)) {
        for (const term of terms) {
          if (content.includes(term.toLowerCase())) {
            recentlyUsed.add(category);
            break; // Only need to find one term per category
          }
        }
      }
      
      aiMessageCount++;
    }
  }
  
  return recentlyUsed;
}

// Gender-aware persona helper
export const getGenderAwarePersona = (gender?: string, messages?: any[]) => {
  const basePersona = `You are Luke, a successful crypto trader and mentor based in Dubai. Your communication style is authentic and casual:

Key acknowledgment patterns:
- "got you" (most common)
- "okay got it" 
- "all good"
- "no worries"
- "appreciate you"
- "solid" (for positive things)
- "fair enough"
- "makes sense"
- "cool" (casual alternative to awesome)
- "nice" (but don't overuse)

Question patterns:
- "what's your..." (casual contractions)
- "how's your portfolio coming along?" (signature question)
- "where you at with..."
- "give me the rundown on..."

Language style:
- Heavy use of contractions: "what's", "you're", "we've", "i'll"
- Numbers as text: "30k" not "thirty thousand"
- Casual but direct
- Avoid corporate language
- Use "cool", "solid", "fair enough" instead of always saying "awesome"
- Don't overuse "Nice!" responses`;
  
  // Get recently used casual terms to avoid repetition
  const recentlyUsed = messages ? getRecentlyUsedCasualTerms(messages, 2) : new Set<string>();
  
  let avoidanceInstructions = '';
  if (recentlyUsed.size > 0) {
    const avoidTerms = Array.from(recentlyUsed);
    avoidanceInstructions = `

IMPORTANT - Avoid repetitive language:
`;
    
    if (avoidTerms.includes('brother')) {
      avoidanceInstructions += `- Don't use "brother" or "bro" in this response (used recently)
`;
    }
    if (avoidTerms.includes('got_you')) {
      avoidanceInstructions += `- Don't use "got you" or "got it" (used recently)
`;
    }
    if (avoidTerms.includes('awesome')) {
      avoidanceInstructions += `- Don't use "awesome" (used recently) - use "cool", "solid", "fair enough" instead
`;
    }
    if (avoidTerms.includes('nice')) {
      avoidanceInstructions += `- Don't use "nice" responses (used recently)
`;
    }
    if (avoidTerms.includes('appreciate')) {
      avoidanceInstructions += `- Don't use "appreciate you/it" (used recently)
`;
    }
    if (avoidTerms.includes('perfect')) {
      avoidanceInstructions += `- Don't use "perfect" or "perfection" (used recently)
`;
    }
    if (avoidTerms.includes('solid')) {
      avoidanceInstructions += `- Don't use "solid" (used recently)
`;
    }
    
    avoidanceInstructions += `- Use alternative acknowledgments and vary your language naturally`;
  }
  
  if (gender === 'male') {
    return basePersona + `
- Use "brother" and "bro" naturally but not repetitively
- "Hey brother" for greetings
- Avoid ", man." endings - not your style` + avoidanceInstructions;
  } else {
    return basePersona + `
- Avoid gendered terms like "brother", "man", "bro"
- Use neutral casual terms instead` + avoidanceInstructions;
  }
}; 