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
import { 
    greetingNode,
    askLocationNode,
    rapportBuildingNode,
    answeringQ1Node,
    answeringQ2Node,
    answeringQ3Node,
    defaultConversationNode
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

A response requires human attention if it:
1. Contains complex financial jargon or legal concepts that need expert knowledge
2. Asks detailed counter-questions requiring specialized expertise
3. Describes a very complex personal financial situation
4. Is completely nonsensical, random, or off-topic (like mentioning animals, unrelated topics, gibberish)
5. Contains inappropriate content or seems like spam/bot behavior
6. Is exceptionally detailed beyond normal conversation flow
7. Shows signs of confusion or misunderstanding about the conversation context

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

    // Check for responses that need human attention first
    if (lastUserMessage) {
        const requiresHuman = await checkForHighSpecificity(state.lastQuestionAsked || '', lastUserMessage);
        if (requiresHuman) {
            return {
                stage: 'human_override',
                isQualified: undefined
            };
        }
    }

    // Dynamic conversation handling based on stage
    if (currentStage === 'greeting') {
        return askLocationNode(state, lastUserMessage, conversationContext);
    }

    if (currentStage === 'rapport_building') {
        return rapportBuildingNode(state, lastUserMessage, conversationContext);
    }

    if (currentStage === 'answering_Q1') {
        return answeringQ1Node(state, lastUserMessage, conversationContext);
    }

    if (currentStage === 'answering_Q2') {
        return answeringQ2Node(state, lastUserMessage, conversationContext);
    }

    if (currentStage === 'answering_Q3') {
        return answeringQ3Node(state, lastUserMessage);
    }
    
    // Fallback to a default response
    return defaultConversationNode(state, lastUserMessage, conversationContext);
}

async function qualifiedNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
    const answers = state.answers;
    const portfolioSize = parsePortfolioSize(answers['Q2_portfolio_size'] as string) || 0;
    
    try {
        // Create qualified lead in GHL
        const { bookingLink } = await ghlService.createQualifiedLead(
            "there",
            "",
            "user",
            portfolioSize,
            answers['Q3_pain_points'] as string || '',
            answers['Q1_bmb_understanding'] as string || '',
            'Instagram DM'
        );
        
        const response = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. here's the link: ${bookingLink}`;

        return {
            response,
            stage: 'booking',
            isQualified: true,
            answers: answers,
            messages: [new AIMessage(response)]
        };
    } catch (error) {
        console.error('Error in qualified node:', error);

        const response = `let's go! you sound like a perfect fit. let's get you booked in for a call with the team. I will send you the link shortly.`;

        return {
            response,
            stage: 'booking',
            isQualified: true,
            answers: answers,
            messages: [new AIMessage(response)]
        };
    }
}

async function nurtureNode(): Promise<Partial<typeof GraphState.State>> {
    const response = "all good bro! For now, I'd recommend diving into our YouTube channel to learn more about BMB: https://www.youtube.com/@bullmarketblueprint. Keep building, and hit me up when you're ready to take the next step. 👍🏻";
    return {
        response,
        stage: 'finished',
        messages: [new AIMessage(response)],
        isQualified: false
    };
}

async function humanOverrideNode(): Promise<Partial<typeof GraphState.State>> {
    // This node is triggered when the conversation requires human intervention.
    // It sets the stage and clears any pending response to ensure the bot doesn't reply.
    return {
        response: '', // Clear any response
        stage: 'human_override',
        isQualified: undefined
    };
}

async function finishedNode(): Promise<Partial<typeof GraphState.State>> {
    const response = "appreciate you brother! feel free to hit me up anytime if you have more questions 🙏🏻";
    return {
        response,
        stage: 'finished',
        messages: [new AIMessage(response)],
    };
}

// Simple router node
async function routerNode(state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> {
    const lastMessage = state.messages[state.messages.length - 1];
    
    // If we're waiting for user input (last message was AI), end the turn
    if (lastMessage instanceof AIMessage) {
        return {};
    }
    
    return {};
}

type NodeNames = 
  | typeof START 
  | typeof END 
  | 'router'
  | 'conversation'
  | 'qualified'
  | 'nurture'
  | 'human_override'
  | 'finished';

// Create the graph
const workflow = new StateGraph<typeof GraphState.spec, typeof GraphState.State, Partial<typeof GraphState.State>, NodeNames>(GraphState);

// Add nodes to the graph
workflow.addNode('router', routerNode);
workflow.addNode('conversation', conversationNode);
workflow.addNode('qualified', qualifiedNode);
workflow.addNode('nurture', nurtureNode);
workflow.addNode('human_override', humanOverrideNode);
workflow.addNode('finished', finishedNode);

// Add edges to the graph
workflow.addEdge(START, 'router');

// Router conditional edges
workflow.addConditionalEdges(
  'router',
  (state) => {
    const { stage } = state;
    // If user is booked or nurtured, the next message is a final wrap-up.
    if (stage === 'booking' || stage === 'nurture') {
      return 'finished';
    }
    // If the process is finished or needs a human, end further AI interaction.
    if (stage === 'human_override' || stage === 'finished') {
      return END;
    }
    // Otherwise, continue the conversation.
    return 'conversation';
  },
  ['conversation', 'finished', END]
);

// Conversation stage transitions
workflow.addConditionalEdges(
  'conversation',
  (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    
    // If AI just responded, END the turn (let user see the message)
    if (lastMessage instanceof AIMessage) {
      return END;
    }
    
    // Only allow transitions to specialized nodes in specific cases
    if (state.stage === 'qualified' && state.isQualified === true) {
      return 'qualified';
    }
    if (state.stage === 'nurture' && state.isQualified === false) {
      return 'nurture';
    }
    if (state.stage === 'human_override') {
      return 'human_override';
    }
    
    // Stay in conversation by default
    return 'conversation';
  },
  ['conversation', 'qualified', 'nurture', 'human_override', END]
);

// These nodes should end the turn so the user sees the message
workflow.addEdge('qualified', END);
workflow.addEdge('nurture', END);
workflow.addEdge('human_override', END);

// The 'finished' node is for a final wrap-up message if the user responds again.
workflow.addEdge('finished', END);

export const graph = workflow.compile(); 