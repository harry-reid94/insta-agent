import { GraphStateType } from './graph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// The UI message format used by the Chat component
export interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

// The full state including LangChain messages
export interface CannedConversation {
  uiMessages: UIMessage[];
  langchainMessages: (HumanMessage | AIMessage)[];
  state: Partial<GraphStateType>;
}

export const nurtureConversation: CannedConversation = {
  uiMessages: [
    { role: 'assistant', content: "what's up bro, how you doing?" },
    { role: 'user', content: 'good you?' },
    { role: 'assistant', content: 'All good, brother! Where you located?' },
    { role: 'user', content: "I'm based in London wbu" },
    { role: 'assistant', content: "Nice man, I'm based in Dubai. So what brings you to BMB? What you heard about us?" },
    { role: 'user', content: 'not much but keen to know more' },
    { role: 'assistant', content: "all good bro. it's an exclusive mastermind for serious crypto investors, giving you the tools, insights, and strategies to build your wealth in crypto.\n\nwhat are you working with portfolio-wise right now?" },
    { role: 'user', content: '30k' },
    { role: 'assistant', content: "Got you brother, that's a solid starting point.\n\nSo, what's the biggest challenge for you right now when it comes to investing?" },
    { role: 'user', content: 'knowing what to buy and when' },
    { role: 'assistant', content: "all good bro! For now, I'd recommend diving into our YouTube channel to learn more about BMB: https://www.youtube.com/@bullmarketblueprint. Keep building, and hit me up when you're ready to take the next step. 👍🏻" },
  ],
  langchainMessages: [
    new AIMessage("what's up bro, how you doing?"),
    new HumanMessage('good you?'),
    new AIMessage('All good, brother! Where you located?'),
    new HumanMessage("I'm based in London wbu"),
    new AIMessage("Nice man, I'm based in Dubai. So what brings you to BMB? What you heard about us?"),
    new HumanMessage('not much but keen to know more'),
    new AIMessage("all good bro. it's an exclusive mastermind for serious crypto investors, giving you the tools, insights, and strategies to build your wealth in crypto.\n\nwhat are you working with portfolio-wise right now?"),
    new HumanMessage('30k'),
    new AIMessage("Got you brother, that's a solid starting point.\n\nSo, what's the biggest challenge for you right now when it comes to investing?"),
    new HumanMessage('knowing what to buy and when'),
    new AIMessage("all good bro! For now, I'd recommend diving into our YouTube channel to learn more about BMB: https://www.youtube.com/@bullmarketblueprint. Keep building, and hit me up when you're ready to take the next step. 👍🏻"),
  ],
  state: {
    stage: 'end',
    isQualified: false,
    location: "London",
    lastQuestionAsked: "So, what's the biggest challenge for you right now when it comes to investing?",
    answers: {
      'Q1_bmb_understanding': 'not much',
      'Q2_portfolio_size': 30000,
      'Q3_pain_points': 'knowing what to buy and when'
    },
    repromptAttempts: {},
  }
}; 