import { NextRequest, NextResponse } from 'next/server';
import { nurtureConversation } from '../../../lib/canned-conversations';
import { AIMessage } from '@langchain/core/messages';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gender = body.gender;
    const conversationId = 'canned-nurture-123'; // Hardcode for simulation
    const followUpContent = gender === 'male' 
      ? "hey brother just checking in to see how your portfolio is coming along"
      : "hey just checking in to see how your portfolio is coming along";
    
    // The full message history for the UI
    const finalUiMessages = [
      ...nurtureConversation.uiMessages,
      { role: 'assistant', content: followUpContent },
    ];

    // The full message history for LangChain state
    const finalLangchainMessages = [
        ...nurtureConversation.langchainMessages,
        new AIMessage(followUpContent),
    ];

    // The new state for the graph
    const newState = {
      ...nurtureConversation.state,
      messages: finalLangchainMessages,
      stage: 'nurture_follow_up',
      lastQuestionAsked: followUpContent,
      response: followUpContent,
      isQualified: undefined,
      gender: gender,
    };

    return NextResponse.json({ 
      messages: finalUiMessages, 
      newState: newState,
      conversationId: conversationId,
    });

  } catch (error) {
    console.error('Error in nurture-follow-up trigger:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize conversation',
        response: "My bad, having some technical issues. Let's try again in a bit.",
      },
      { status: 500 }
    );
  }
} 