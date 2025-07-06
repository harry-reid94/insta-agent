import { NextRequest, NextResponse } from 'next/server';
import { GraphState } from '../../../lib/graph';
import { AIMessage } from '@langchain/core/messages';
import { greetingNode } from '../../../lib/stages';

export const runtime = 'nodejs';

async function getInitialMessage(gender?: string) {
  const conversationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const thanksMessage = gender === 'male' ? "Hey man, thanks for the follow!" : "Hey, thanks for the follow!";
  
  // Get the standard greeting
  const greetingResult = await greetingNode({ gender } as any, { noGreetingWord: true });
  const greetingMessage = greetingResult.response;

  const combinedMessage = `${thanksMessage}\n\n${greetingMessage}`;

  const initialState: typeof GraphState.State = {
    messages: [
      new AIMessage(thanksMessage),
      new AIMessage(greetingMessage),
    ],
    stage: 'greeting', // Follows the normal flow now
    answers: {},
    lastQuestionAsked: greetingMessage, // The last question is the greeting
    isQualified: undefined,
    currentQuestionId: undefined,
    repromptAttempts: {},
    location: undefined,
    response: combinedMessage,
    availableSlots: [],
    gender: gender,
  };

  return {
    response: combinedMessage,
    newState: initialState,
    conversationId: conversationId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gender = body.gender;
    const data = await getInitialMessage(gender);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in new-follower trigger:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize conversation',
        response: "My bad bro, having some technical issues. Let's try again in a bit.",
      },
      { status: 500 }
    );
  }
} 