import { NextRequest, NextResponse } from 'next/server';
import { graph, GraphState } from '../../../lib/graph';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const conversationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const initialState: typeof GraphState.State = {
      messages: [],
      stage: 'greeting',
      answers: {},
      lastQuestionAsked: '',
      isQualified: undefined,
      currentQuestionId: undefined,
      repromptAttempts: {},
      location: undefined,
      response: '',
      availableSlots: [],
    };
    
    const result = await graph.invoke(initialState);
    
    return NextResponse.json({ 
      response: result.response, 
      newState: { ...result, conversationId },
      conversationId: conversationId,
    });

  } catch (error) {
    console.error('Error in manual-trigger:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize conversation',
        response: "My bad bro, having some technical issues. Let's try again in a bit.",
      },
      { status: 500 }
    );
  }
} 