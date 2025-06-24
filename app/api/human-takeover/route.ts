import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '../../lib/integrations/supabase';

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

    // Update conversation state to human_override
    await supabaseService.saveConversationState({
      conversation_id: conversationId,
      instagram_user_id: conversationState.instagram_user_id,
      current_stage: 'human_override',
      answers: conversationState.answers,
      last_question_asked: conversationState.last_question_asked,
      is_qualified: conversationState.is_qualified,
      is_specific: true, // Mark as requiring human attention
      location: conversationState.location,
      reprompt_attempts: conversationState.reprompt_attempts || {}
    });

    // Update lead data
    await supabaseService.upsertLead({
      ...lead,
      stage: 'human_override',
      metadata: {
        ...lead.metadata,
        human_takeover_requested: true,
        human_takeover_timestamp: new Date().toISOString()
      }
    });

    // Log the human takeover request
    await supabaseService.logMessage({
      instagram_user_id: conversationState.instagram_user_id,
      instagram_username: lead.instagram_username || 'unknown',
      conversation_id: conversationId,
      stage: 'human_override',
      message_from: 'agent',
      message_content: 'Conversation marked for human takeover',
      timestamp: new Date().toISOString(),
      metadata: { 
        human_takeover: true,
        previous_stage: conversationState.current_stage
      }
    });

    // TODO: Send notification to human agents (email, Slack, etc.)
    // This could be implemented with additional notification services

    return NextResponse.json({ 
      success: true, 
      message: 'Conversation marked for human takeover',
      conversationId,
      previousStage: conversationState.current_stage
    });

  } catch (error) {
    console.error('Human takeover error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error 
    }, { status: 500 });
  }
} 