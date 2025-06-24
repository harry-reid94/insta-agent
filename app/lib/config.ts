import { ConversationStage } from './types';

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

// Helper function to parse numeric portfolio sizes including shorthand like 50k or 2.3m
export function parsePortfolioSize(text: string): number | null {
  const match = text.match(/(\d[\d,.]*)(?:\s*)([kKmM]?)/);
  if (!match) return null;
  let num = parseFloat(match[1].replace(/[,]/g, ''));
  if (isNaN(num)) return null;
  const suffix = match[2];
  if (/k/i.test(suffix)) num *= 1_000;
  if (/m/i.test(suffix)) num *= 1_000_000;
  return Math.round(num);
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
        const portfolioSize = parsePortfolioSize(answer);
        return portfolioSize !== null && portfolioSize < 50000;
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