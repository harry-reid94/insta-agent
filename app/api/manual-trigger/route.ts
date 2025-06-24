import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '../../lib/integrations/supabase';
import { instagramService } from '../../lib/integrations/instagram';
import { graph, GraphState } from '../../lib/graph';
import { HumanMessage } from '@langchain/core/messages';

export async function POST(req: NextRequest) {
  try {
    const { conversationId } = await req.json();
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // Get conversation state
    const conversationState = await supabaseService.getConversationState(conversationId);
    if (!conversationState) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get lead data
    const lead = await supabaseService.getLeadByConversationId(conversationId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Create a greeting message to restart the conversation
    const restartMessage = "Let's pick up where we left off. How can I help you today?";

    // Process through the AI workflow
    const graphState: typeof GraphState.State = {
      messages: [new HumanMessage(restartMessage)],
      stage: 'greeting',
      answers: conversationState.answers,
      lastQuestionAsked: '',
      isQualified: conversationState.is_qualified,
      currentQuestionId: undefined,
      repromptAttempts: {},
      location: conversationState.location,
      response: ''
    };

    const result = await graph.invoke(graphState);
    
    if (result.response) {
      // Get user info for personalization
      try {
        const userInfo = await instagramService.getUserInfo(conversationState.instagram_user_id);
        const firstName = instagramService.extractFirstName(userInfo);
        
        // Personalize the response
        const personalizedResponse = result.response.replace('{FirstName}', firstName);
        
        // Send message via Instagram
        await instagramService.sendConversationResponse(conversationId, personalizedResponse);
        
        // Log the manual trigger
        await supabaseService.logMessage({
          instagram_user_id: conversationState.instagram_user_id,
          instagram_username: lead.instagram_username || 'unknown',
          conversation_id: conversationId,
          stage: 'manual_trigger',
          message_from: 'agent',
          message_content: personalizedResponse,
          timestamp: new Date().toISOString(),
          metadata: { triggered_manually: true }
        });
        
        // Update conversation state
        await supabaseService.saveConversationState({
          conversation_id: conversationId,
          instagram_user_id: conversationState.instagram_user_id,
          current_stage: result.stage || 'greeting',
          answers: result.answers || conversationState.answers,
          last_question_asked: result.lastQuestionAsked,
          is_qualified: result.isQualified,
          is_specific: false,
          location: result.location || conversationState.location,
          reprompt_attempts: result.repromptAttempts || {}
        });

        return NextResponse.json({ 
          success: true, 
          message: 'AI workflow triggered successfully',
          response: personalizedResponse
        });
      } catch (error) {
        console.error('Error sending Instagram message:', error);
        return NextResponse.json({ 
          success: true, 
          message: 'AI workflow triggered but failed to send Instagram message',
          error: error 
        }, { status: 200 });
      }
    }

    return NextResponse.json({ 
      success: false, 
      message: 'AI workflow did not generate a response' 
    }, { status: 500 });

  } catch (error) {
    console.error('Manual trigger error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error 
    }, { status: 500 });
  }
} 