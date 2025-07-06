import { NextRequest, NextResponse } from 'next/server';
import { graph, GraphState } from '../../lib/graph';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { ConversationStage } from '../../lib/types';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

interface UIMessage {
  type: 'human' | 'ai';
  content: string;
}

interface ChatRequestBody {
  messages: UIMessage[] | BaseMessage[];
  state?: Partial<typeof GraphState.State>;
  conversationId?: string;
}

const FALLBACK_RESPONSES = {
  GREETING: "Hey man! What's up?",
  ERROR: "My bad bro, having some technical issues. Can you try that again?",
  NO_RESPONSE: "Hey brother! Let me know what's on your mind!",
};

// Helper function to convert UI messages to LangGraph messages
function convertToLangGraphMessages(messages: UIMessage[] | BaseMessage[]): BaseMessage[] {
  if (!Array.isArray(messages)) return [];
  
  return messages.map(msg => {
    // If it's already a BaseMessage, return as-is
    if ('lc_namespace' in msg) {
      return msg as BaseMessage;
    }
    
    // Convert UI message to LangGraph message
    const uiMsg = msg as UIMessage;
    if (uiMsg.type === 'human') {
      return new HumanMessage(uiMsg.content);
    } else {
      return new AIMessage(uiMsg.content);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { messages = [], state = {}, conversationId }: ChatRequestBody = body;

    if (!conversationId) {
      // This case should ideally not happen if the UI is working correctly
      console.error('Error: conversationId is missing in the request');
      return NextResponse.json({ 
        error: 'Internal server error: Missing conversationId',
        response: FALLBACK_RESPONSES.ERROR,
        newState: {} 
      }, { status: 500 });
    }

    // Convert UI messages to LangGraph messages
    const initialMessages = convertToLangGraphMessages(messages);

    // Initialize state with defaults
    const initialState: typeof GraphState.State = {
      messages: initialMessages,
      stage: (state.stage as ConversationStage) || 'greeting',
      answers: state.answers || {},
      lastQuestionAsked: state.lastQuestionAsked || '',
      isQualified: state.isQualified,
      currentQuestionId: state.currentQuestionId,
      repromptAttempts: state.repromptAttempts || {},
      location: state.location,
      response: state.response || '',
      availableSlots: state.availableSlots || [],
      gender: state.gender,
      instagramUsername: state.instagramUsername,
      conversationId: state.conversationId,
    };
    
    console.log('Initial state:', JSON.stringify(initialState, null, 2));
    
    // Invoke graph
    const result = await graph.invoke(initialState);
    console.log('Graph result:', JSON.stringify(result, null, 2));

    // Save conversation to file
    try {
      const dir = path.join('/tmp', 'conversations');
      await fs.mkdir(dir, { recursive: true });
      const filename = `${conversationId}.json`;
      const filepath = path.join(dir, filename);
      const conversationData = {
        initialState,
        result,
      };
      await fs.writeFile(filepath, JSON.stringify(conversationData, null, 2));
      console.log(`Conversation saved to ${filepath}`);
    } catch (saveError) {
      console.error('Failed to save conversation:', saveError);
      // Don't block the response for this, just log it
    }

    // Allow empty responses if the conversation is being escalated
    if (result.stage === 'human_override') {
      return NextResponse.json({ 
        response: '', 
        newState: result 
      });
    }

    // Handle missing response
    if (!result || !result.response) {
      console.error('No response from graph');
      return NextResponse.json({ 
        error: 'No response generated',
        response: initialState.messages.length === 0 ? FALLBACK_RESPONSES.GREETING : FALLBACK_RESPONSES.NO_RESPONSE,
        newState: {
          ...initialState,
          messages: [
            ...initialState.messages,
            new AIMessage(initialState.messages.length === 0 ? FALLBACK_RESPONSES.GREETING : FALLBACK_RESPONSES.NO_RESPONSE)
          ]
        }
      });
    }

    // Return successful response
    return NextResponse.json({ 
      response: result.response, 
      newState: result 
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    
    // Return error response with fallback message
    return NextResponse.json({ 
      error: 'Internal server error',
      response: FALLBACK_RESPONSES.ERROR,
      newState: {
        messages: [],
        stage: 'greeting',
        answers: {},
        lastQuestionAsked: '',
        isQualified: undefined,
        currentQuestionId: undefined,
        repromptAttempts: {},
        location: undefined,
        response: FALLBACK_RESPONSES.ERROR
      }
    });
  }
} 