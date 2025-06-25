import { ConversationStage } from './types';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { model } from './shared';

export interface QualificationNode {
  id: string;
  question: string;
  followUp?: string;
  required?: boolean;
  disqualifyOn?: (answer: string) => boolean;
  promptIntent?: string;
  repromptIntent?: string;
  highSpecificityDetection?: boolean;
  expectedResponseType?: string;
}

export interface AgentConfig {
  greetingIntent: string;
  nurtureIntent: string;
  bookingOfferIntent: string;
  qualificationNodes: QualificationNode[];
  disallowedQuestionKeywords: string[];
}

// Helper function to parse numeric portfolio sizes including shorthand like 50k or 2.3m, and natural language like "50 grand"
export async function parsePortfolioSize(text: string): Promise<number | null> {
    if (!text || text.trim() === '') {
        return null;
    }

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are a data extraction specialist. Your task is to extract a numerical portfolio size from a given text.

The user might state their portfolio size in various ways, including numbers, shorthand (e.g., 'k' for thousands, 'm' for millions), or natural language (e.g., "grand" for a thousand).

Your goal is to interpret the text and return only the final numerical value in USD.

- "50k" should be 50000.
- "2.3m" should be 2300000.
- "50 grand" should be 50000.
- "around 100k" should be 100000.
- "I have about 75,000" should be 75000.
- "probably twenty five thousand dollars" should be 25000.
- "a million" should be 1000000.
- If the user says they don't know, don't want to say, or the text is not related to a portfolio size, output "null".
- If no specific number can be found, output "null".

User input: "${text}"

Output only the number or the word "null".`],
    ]);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const result = await chain.invoke({});

    if (result.toLowerCase() === 'null' || result.trim() === '') {
        return null;
    }

    const num = parseFloat(result.replace(/[,]/g, ''));
    return isNaN(num) ? null : Math.round(num);
}

export const defaultConfig: AgentConfig = {
  greetingIntent: "Hey {FirstName}! Appreciate the message. Did BullMarketBlueprint catch your attention? (check origin: story, comment, ad, etc.)",
  nurtureIntent: "Thanks for reaching out, man! While you're getting your portfolio sorted, here are some free resources that might help you on your journey. Check out our blog at [link] and feel free to reach out once you've built up your investment capital a bit more. Keep grinding!",
  bookingOfferIntent: "Awesome, sounds like you're exactly who we help! I'd love to get you connected with one of our portfolio strategists. Let me grab you a free 15-minute strategy call where we can dive deeper into your situation and see how BullMarketBlueprint can help you optimize your portfolio. Here's your booking link: [BOOKING_LINK]",
  qualificationNodes: [
    {
      id: 'Q1_portfolio_size',
      question: "What's your portfolio size/current asset allocation?",
      followUp: "Could you give me a rough idea of your current portfolio size? Even a ballpark figure helps.",
      required: true,
      promptIntent: "Ask about their current portfolio size and asset allocation in Luke's friendly style",
      repromptIntent: "Ask about their portfolio size again, acknowledging their previous response",
      highSpecificityDetection: true,
      expectedResponseType: 'portfolio_size',
      disqualifyOn: (answer) => {
        // TODO: This needs to be async now. This part of config seems unused by the main graph.
        // const portfolioSize = await parsePortfolioSize(answer);
        // return portfolioSize !== null && portfolioSize < 50000;
        return false;
      }
    },
    {
      id: 'Q2_pain_points',
      question: "What pain points are you facing? (exit strategy, too many assets, etc.)",
      followUp: "What specific challenges are you dealing with in your investment portfolio right now?",
      required: true,
      promptIntent: "Ask about their investment pain points and challenges in Luke's conversational style",
      repromptIntent: "Ask about their pain points again, showing you understand their situation",
      highSpecificityDetection: true,
      expectedResponseType: 'pain_points'
    },
    {
      id: 'Q3_bmb_understanding',
      question: "What's your understanding of BullMarketBlueprint and what we do?",
      followUp: "What do you know about BullMarketBlueprint so far? How did you hear about us?",
      required: true,
      promptIntent: "Ask about their understanding of BullMarketBlueprint in Luke's style",
      repromptIntent: "Ask about their knowledge of BMB again, showing interest in their perspective",
      highSpecificityDetection: true,
      expectedResponseType: 'bmb_understanding'
    }
  ],
  disallowedQuestionKeywords: [
    'sorry',
    'apologies',
    'apologize',
    'unfortunately',
    'regret',
    'bad news',
    'instagram',
    'ig',
    'social media',
    'handle',
    'follow'
  ]
}; 