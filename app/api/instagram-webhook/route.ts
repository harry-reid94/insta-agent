import { NextRequest, NextResponse } from 'next/server';
import { graph, GraphState } from '../../lib/graph';
import { manyChatService } from '../../lib/integrations/manychat';
import { HumanMessage } from '@langchain/core/messages';

// Simplified webhook specifically for Instagram that just returns the AI response as text
export async function POST(req: NextRequest) {
  try {
    console.log('📱 Instagram webhook called');
    
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !manyChatService.verifyWebhookAuth(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    console.log('📱 Instagram data:', data);
    
    // Extract basic info
    const message = data.message || 'Hello';
    const firstName = data.first_name || 'friend';
    const username = data.username || 'user';
    
    // Simple AI processing
    const graphState: typeof GraphState.State = {
      messages: [new HumanMessage(message)],
      stage: 'greeting',
      answers: {},
      lastQuestionAsked: '',
      isQualified: undefined,
      currentQuestionId: undefined,
      repromptAttempts: {},
      location: undefined,
      response: '',
      availableSlots: [],
      gender: undefined,
      instagramUsername: username,
      conversationId: data.conversation_id || 'instagram_test'
    };

    console.log('🤖 Processing through AI...');
    const result = await graph.invoke(graphState);
    
    console.log('💬 AI response:', result.response);
    
    // Return just the text response - simplest format for Instagram
    return new NextResponse(result.response, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
  } catch (error: any) {
    console.error('❌ Instagram webhook error:', error);
    return new NextResponse('Sorry, I had a technical issue. Please try again.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}