// This file contains the LangGraph definition for the chat agent.

import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ConversationStage } from './types';
import { parsePortfolioSize } from './config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { JsonOutputFunctionsParser } from 'langchain/output_parsers';
import { ghlService } from './integrations/gohighlevel';
import { analyticalModel } from './shared';
import { availabilityService } from './availabilityService';
import { 
    greetingNode,
    askLocationNode,
    rapportBuildingNode,
    locationResponseNode,
    cryptoInterestQuestionsNode,
    answeringQ1Node,
    answeringQ2Node,
    answeringQ3Node,
    collectEmailNode,
    bookingConfirmationNode,
    defaultConversationNode,
    nurtureFollowUpNode,
    nurtureFollowUpRepromptNode,
} from './stages';

// Define the state schema using Annotation
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (state: BaseMessage[], update: BaseMessage | BaseMessage[]) => {
      if (Array.isArray(update)) {
        return state.concat(update);
      }
      return state.concat([update]);
    },
    default: () => []
  }),
  stage: Annotation<ConversationStage>({
    reducer: (x: ConversationStage, y: ConversationStage) => y,
    default: () => 'greeting'
  }),
  answers: Annotation<Record<string, string | number>>({
    reducer: (x: Record<string, string | number>, y: Record<string, string | number>) => ({...x, ...y}),
    default: () => ({})
  }),
  lastQuestionAsked: Annotation<string>({
    reducer: (x: string, y: string) => y,
    default: () => ''
  }),
  isQualified: Annotation<boolean | undefined>({
    reducer: (x: boolean | undefined, y: boolean | undefined) => y,
    default: () => undefined
  }),
  currentQuestionId: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined
  }),
  repromptAttempts: Annotation<Record<string, number>>({
    reducer: (x: Record<string, number>, y: Record<string, number>) => ({...x, ...y}),
    default: () => ({})
  }),
  location: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined
  }),
  response: Annotation<string>({
    reducer: (x: string, y: string) => y,
    default: () => ''
  }),
  availableSlots: Annotation<string[]>({
    reducer: (x: string[], y: string[]) => y,
    default: () => []
  }),
  gender: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined
  }),
  instagramUsername: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined
  }),
  conversationId: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined
  }),
  isSpecific: Annotation<boolean | undefined>({
    reducer: (x: boolean | undefined, y: boolean | undefined) => y,
    default: () => undefined
  })
});

// Export the state type
export type GraphStateType = typeof GraphState.State;

// Helper functions for state management
function getLastUserMessage(state: GraphStateType): string {
    // Find the most recent human message
    for (let i = state.messages.length - 1; i >= 0; i--) {
        const message = state.messages[i];
        if (message instanceof HumanMessage) {
            const content = typeof message.content === 'string' ? message.content : message.content.toString();
            return content;
        }
    }
    return '';
}

// Helper to get conversation context for the LLM
function getConversationContext(state: GraphStateType): string {
    const recentMessages = state.messages.slice(-6); // Last 6 messages for context
    return recentMessages.map(msg => {
        if (msg instanceof HumanMessage) {
            return `User: ${msg.content}`;
        } else if (msg instanceof AIMessage) {
            return `Luke: ${msg.content}`;
        }
        return '';
    }).join('\n');
}

async function checkForHighSpecificity(question: string, answer: string): Promise<boolean> {
    const specificityFunction = {
        name: "specificity_check",
        description: "Determines if a user's response requires human expert attention.",
        parameters: {
            type: "object",
            properties: {
                requiresHuman: {
                    type: "boolean",
                    description: "True if the response requires human expert attention, false otherwise.",
                },
            },
            required: ["requiresHuman"],
        },
    };

    const functionCallingModel = analyticalModel.bind({
        functions: [specificityFunction],
        function_call: { name: "specificity_check" },
    });

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are evaluating if a user's response in a financial services conversation requires escalation to a human expert.

This conversation is about BullMarketBlueprint (BMB), a trading/investment service. Common valid responses include:
- "BMB" (referring to BullMarketBlueprint)
- Investment amounts, portfolio sizes
- Trading-related questions
- Basic scheduling responses
- Simple personal information

A response requires human attention if it:
1. Contains complex financial jargon or legal concepts that need expert knowledge
2. Asks detailed counter-questions requiring specialized expertise
3. Describes a very complex personal financial situation
4. Is completely nonsensical, random, or off-topic (like mentioning animals, unrelated topics, gibberish)
5. Contains inappropriate, offensive, racist, or discriminatory content, or seems like spam/bot behavior
6. Is exceptionally detailed beyond normal conversation flow
7. Shows signs of confusion or misunderstanding about the conversation context

However, do NOT flag responses that are:
- Simple, direct answers to scheduling questions (e.g., "10am works", "tomorrow at 2pm", "none of those work for me")
- Basic investment-related responses ("BMB", "trading", "portfolio", "investing")
- Common conversational responses ("good", "thanks", "yes", "no")

Examples that need human attention:
- "german shepherds at risk of colossal incoherence" (nonsensical)
- "I have 47 different cryptocurrency wallets with complex derivatives" (overly complex)
- "What's your favorite pizza topping?" (completely off-topic)
- Complex legal or tax questions
- Responses that don't make sense in context

Your goal is to catch ANY response that would be difficult for a simple AI agent to handle appropriately.`],
        ["user", `The agent asked the user: "${question}"\nThe user responded with: "${answer}"\n\nDoes the user's response require human attention?`],
    ]);
    
    const chain = prompt.pipe(functionCallingModel).pipe(new JsonOutputFunctionsParser());
    
    try {
        const result = await chain.invoke({ question, answer }) as { requiresHuman: boolean };
        return result.requiresHuman;
    } catch {
        return false;
    }
}

// Core conversation node - handles all conversational logic dynamically
async function conversationNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
    const lastUserMessage = getLastUserMessage(state);
    const conversationContext = getConversationContext(state);
    const currentStage = state.stage;
    
    // If no messages yet, start with greeting
    if (state.messages.length === 0) {
        return greetingNode(state);
    }
    
    // If we're at greeting stage with no AI messages, start with greeting
    if (currentStage === 'greeting' && !state.messages.some(msg => msg instanceof AIMessage)) {
        console.log('🎯 No AI messages found, generating greeting');
        return greetingNode(state);
    }
    
    // Debug: Check if we have AI messages when stage is greeting
    if (currentStage === 'greeting') {
        const hasAIMessages = state.messages.some(msg => msg instanceof AIMessage);
        console.log('🔍 Greeting stage debug:', {
            hasAIMessages,
            totalMessages: state.messages.length,
            lastUserMessage: lastUserMessage?.substring(0, 20)
        });
    }

    // Check for responses that need human attention first
    let isSpecific: boolean | undefined = undefined;
    if (lastUserMessage) {
        const requiresHuman = await checkForHighSpecificity(state.lastQuestionAsked || '', lastUserMessage);
        isSpecific = requiresHuman;
        if (requiresHuman) {
            return {
                stage: 'human_override',
                isQualified: undefined,
                isSpecific: true
            };
        }
    }

    // Dynamic conversation handling based on stage
    let result: Partial<typeof GraphState.State>;
    if (currentStage === 'greeting') {
        result = await askLocationNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'rapport_building') {
        result = await rapportBuildingNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'location_response') {
        result = await locationResponseNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'crypto_interest_questions') {
        result = await cryptoInterestQuestionsNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'nurture_follow_up') {
        result = await nurtureFollowUpNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'nurture_follow_up_reprompt') {
        result = await nurtureFollowUpRepromptNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'answering_Q1') {
        result = await answeringQ1Node(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'answering_Q2') {
        result = await answeringQ2Node(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'answering_Q3') {
        result = await answeringQ3Node(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'collect_email') {
        result = await collectEmailNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'booking') {
        result = await collectEmailNode(state, lastUserMessage, conversationContext);
    } else if (currentStage === 'collecting_email') {
        result = await bookingConfirmationNode(state, lastUserMessage, conversationContext);
    } else {
        result = await defaultConversationNode(state, lastUserMessage, conversationContext);
    }
    // Attach isSpecific to the result if it was set
    if (typeof isSpecific !== 'undefined') {
        result.isSpecific = isSpecific;
    }
    return result;
}

async function nurtureNode(): Promise<Partial<GraphStateType>> {
    const response = "appreciate you sharing! Right now, BMB probably isn't the right fit based on your current situation. We're generally looking for investors with a bit more capital to make the most of the strategies we teach.\n\nBut I've got some free resources that might help you on your journey: https://www.youtube.com/@bullmarketblueprint\n\nKeep building, and let's catch up when your portfolio grows.";
    return {
        response,
        stage: 'end',
        messages: [new AIMessage(response)],
        isQualified: false
    };
}

async function humanOverrideNode(): Promise<Partial<typeof GraphState.State>> {
    return {
        response: '', // Do not send a message, just flag for override
        stage: 'human_override',
        isQualified: undefined
    };
}

type NodeNames = 
  | typeof START 
  | typeof END 
  | 'conversation'
  | 'nurture'
  | 'human_override';

// Create the graph
const workflow = new StateGraph<typeof GraphState.spec, typeof GraphState.State, Partial<typeof GraphState.State>, NodeNames>(GraphState);

// Add nodes to the graph
workflow.addNode('conversation', conversationNode);
workflow.addNode('nurture', nurtureNode);
workflow.addNode('human_override', humanOverrideNode);

// Set entry point
workflow.addEdge(START, 'conversation');

// Add conditional edges from conversation node
workflow.addConditionalEdges(
  'conversation',
  (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    
    // If AI just responded, END the turn (let user see the message)
    if (lastMessage instanceof AIMessage) {
      return END;
    }
    
    // Check for special states that require routing to specific nodes
    if (state.stage === 'nurture' && state.isQualified === false) {
      return 'nurture';
    }
    if (state.stage === 'human_override') {
      return 'human_override';
    }
    if (state.stage === 'end') {
      return END;
    }
    
    // Stay in conversation by default
    return 'conversation';
  },
  ['conversation', 'nurture', 'human_override', END]
);

// These nodes should end the turn so the user sees the message
workflow.addEdge('nurture', END);
workflow.addEdge('human_override', END);

export const graph = workflow.compile(); 