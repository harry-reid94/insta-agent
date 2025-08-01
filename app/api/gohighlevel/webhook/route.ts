import { NextRequest, NextResponse } from 'next/server';
import { graph, GraphState } from '../../../lib/graph';
import { ghlService, isGHLConfigured } from '../../../lib/integrations/gohighlevel';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Handle GoHighLevel webhook for Instagram DMs
export async function POST(req: NextRequest) {
  try {
    // Verify webhook authentication
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET || '';
    
    console.log('🔐 GHL webhook auth check');
    
    if (!ghlService.verifyWebhookAuth(authHeader || '', webhookSecret)) {
      console.error('❌ GoHighLevel webhook authentication failed');
      return NextResponse.json(
        ghlService.createErrorResponse("Sorry, I'm having trouble right now. Please try again later."),
        { status: 401 }
      );
    }

    let webhookData;
    try {
      const rawBody = await req.text();
      console.log('📦 Raw request body:', rawBody || '(empty)');
      webhookData = rawBody ? JSON.parse(rawBody) : {};
    } catch (jsonError) {
      console.log('⚠️  Invalid JSON in request body');
      return NextResponse.json({
        response: "✅ Webhook connected! Please check your webhook configuration in GoHighLevel.",
        status: "connected"
      });
    }
    
    console.log('📨 GoHighLevel webhook received and authenticated');
    console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

    // Handle test requests
    if (!webhookData.contact_id && !webhookData.user_id && Object.keys(webhookData).length < 3) {
      return NextResponse.json({
        response: "✅ Webhook connected! Ready to receive messages.",
        status: "ready"
      });
    }

    // Process the webhook to extract message data
    const messageData = ghlService.processWebhook(webhookData);
    if (!messageData) {
      console.log('⚠️  No actionable message data found in GoHighLevel webhook');
      return NextResponse.json(
        ghlService.createErrorResponse("I didn't understand that. Can you try again?")
      );
    }

    const { userId, username, firstName, message, conversationId, stage, timestamp, previousAnswers, customFields } = messageData;

    console.log(`🤖 Processing message from ${firstName} (${username}) at stage: ${stage}`);
    console.log('📝 Previous answers raw:', previousAnswers);
    console.log('📝 Custom fields:', customFields);

    // Use stage directly without mapping - let the graph handle transitions
    let currentStage = stage;

    // Build message history from stored conversation
    const graphMessages: any[] = [];
    
    // Try to parse answers from custom fields if it's a string
    let parsedAnswers = previousAnswers;
    if (typeof previousAnswers === 'string' && previousAnswers !== 'null') {
      try {
        // Handle double-escaped JSON from GHL
        let cleanedAnswers = previousAnswers;
        if (cleanedAnswers.includes('\\"')) {
          cleanedAnswers = cleanedAnswers.replace(/\\"/g, '"');
        }
        parsedAnswers = JSON.parse(cleanedAnswers);
        console.log('✅ Successfully parsed answers:', parsedAnswers);
      } catch (e) {
        console.warn('Failed to parse previousAnswers:', e);
        console.warn('Raw previousAnswers:', previousAnswers);
        parsedAnswers = {};
      }
    } else if (previousAnswers === 'null' || !previousAnswers) {
      parsedAnswers = {};
    }
    
    // Restore conversation history from answers field
    if (parsedAnswers && parsedAnswers.conversation_history) {
      try {
        const history = parsedAnswers.conversation_history;
        console.log('🔄 Restoring conversation history:', history);
        for (const msg of history) {
          if (msg.type === 'human') {
            graphMessages.push(new HumanMessage(msg.content));
          } else if (msg.type === 'ai') {
            graphMessages.push(new AIMessage(msg.content));
          }
        }
        console.log('✅ Restored', graphMessages.length, 'messages from history');
      } catch (error) {
        console.warn('Failed to restore conversation history:', error);
      }
    }
    
    // Handle message addition logic
    if (stage === 'greeting' && (!message || message.trim() === '')) {
      // First greeting - no user message yet
      console.log('🎯 Initial greeting → triggering greetingNode (empty messages)');
    } else {
      // User has responded or we're past greeting stage - add their message
      console.log('➡️ Adding user message for processing:', message);
      graphMessages.push(new HumanMessage(message));
    }

    // Create graph state with restored context
    const graphState: typeof GraphState.State = {
      messages: graphMessages,
      stage: currentStage as any,
      answers: parsedAnswers?.answers || parsedAnswers || {},
      lastQuestionAsked: parsedAnswers?.lastQuestionAsked || '',
      isQualified: parsedAnswers?.isQualified,
      currentQuestionId: parsedAnswers?.currentQuestionId,
      repromptAttempts: parsedAnswers?.repromptAttempts || {},
      location: parsedAnswers?.location,
      response: '',
      availableSlots: parsedAnswers?.availableSlots || [],
      gender: customFields?.gender || webhookData.gender,
      instagramUsername: username,
      conversationId: conversationId,
      isSpecific: undefined
    };

    console.log('🤖 Processing message through AI graph...');
    console.log('📊 Graph state:', {
      stage: graphState.stage,
      messageCount: graphState.messages.length,
      hasAnswers: Object.keys(graphState.answers).length > 0
    });

    // Process through AI
    const result = await graph.invoke(graphState);
    
    console.log('📈 Graph result:', {
      resultStage: result.stage,
      hasResponse: !!result.response,
      isQualified: result.isQualified,
      isSpecific: result.isSpecific,
      messages: result.messages?.length,
      fullResult: JSON.stringify(result, null, 2)
    });

    if (!result.response) {
      console.log('⚠️  AI graph did not generate a response');
      return NextResponse.json({
        response: "I'm having trouble responding right now. Please try again.",
        status: "error"
      });
    }

    console.log('💬 AI generated response:', result.response.substring(0, 100) + '...');

    // Prepare response with custom fields for GoHighLevel
    const responseCustomFields: Record<string, any> = {
      stage: result.stage,
      last_response: result.response,
      updated_at: new Date().toISOString(),
      is_specific: result.isSpecific,
      intent: result.answers?.intent || '' // Add intent at top level
    };

    // Store answers and conversation history in custom fields
    // Store conversation history for context restoration
    const conversationHistory = result.messages?.map(msg => ({
      type: msg instanceof HumanMessage ? 'human' : 'ai',
      content: msg.content
    })) || [];
    
    const updatedAnswers = {
      answers: result.answers || {},
      conversation_history: conversationHistory,
      lastQuestionAsked: result.lastQuestionAsked,
      repromptAttempts: result.repromptAttempts || {},
      location: result.location,
      availableSlots: result.availableSlots || [],
      isQualified: result.isQualified,
      currentQuestionId: result.currentQuestionId
    };
    
    responseCustomFields.answers = JSON.stringify(updatedAnswers);
    
    // Extract specific fields for GHL
    if (result.answers) {
      console.log('🔍 Extracting fields from answers:', result.answers);
      
      if (result.answers['Q1_bmb_understanding']) {
        responseCustomFields.bmb_understanding = result.answers['Q1_bmb_understanding'];
        console.log('✅ Set bmb_understanding:', responseCustomFields.bmb_understanding);
      } else {
        console.log('⚠️  Q1_bmb_understanding not found in answers');
      }
      
      if (result.answers['Q2_portfolio_size']) {
        responseCustomFields.portfolio_size = result.answers['Q2_portfolio_size'];
        console.log('✅ Set portfolio_size:', responseCustomFields.portfolio_size);
      }
      
      if (result.answers['Q3_pain_points']) {
        // Expand short pain point answers for better storage
        let painPoints = result.answers['Q3_pain_points'].toString();
        if (painPoints.length < 10) {
          // Common expansions for short answers
          const expansions: Record<string, string> = {
            'timing': 'Timing the market',
            'risk': 'Risk management',
            'exits': 'Exit strategies',
            'entries': 'Entry points',
            'portfolio': 'Portfolio management',
            'taxes': 'Tax implications',
            'volatility': 'Market volatility'
          };
          const lowerPain = painPoints.toLowerCase();
          painPoints = expansions[lowerPain] || painPoints;
        }
        responseCustomFields.pain_points = painPoints;
        console.log('✅ Set pain_points:', responseCustomFields.pain_points);
      } else {
        console.log('⚠️  Q3_pain_points not found in answers');
      }
      
      // Also set email if present
      if (result.answers['email']) {
        responseCustomFields.email = result.answers['email'];
        console.log('✅ Set email:', responseCustomFields.email);
      }
      
      // Set crypto experience if present
      if (result.answers['crypto_experience']) {
        responseCustomFields.crypto_experience = result.answers['crypto_experience'];
        console.log('✅ Set crypto_experience:', responseCustomFields.crypto_experience);
      }
      
      // Set intent if present
      if (result.answers['intent']) {
        responseCustomFields.intent = result.answers['intent'];
        console.log('✅ Set intent:', responseCustomFields.intent);
      }
    }

    // Handle qualification status
    if (result.isQualified === true) {
      console.log('🎯 Lead qualified!');
      
      responseCustomFields.is_qualified = 'true';
      responseCustomFields.qualification_date = new Date().toISOString();
      
      // Generate booking link for qualified leads
      const bookingLink = process.env.GHL_BOOKING_LINK || 
                         `https://app.gohighlevel.com/widget/booking/${process.env.GHL_CALENDAR_ID}`;
      responseCustomFields.booking_link = bookingLink;
      
      // Update contact in GoHighLevel with qualification data
      if (isGHLConfigured() && userId) {
        try {
          // Update contact with custom fields
          await ghlService.updateContact(userId, {
            tags: ['qualified', 'bmb_prospect'],
            customFields: responseCustomFields
          });
          
          // Create opportunity if not exists
          const portfolioSize = parseInt(result.answers['Q2_portfolio_size']?.toString() || '0');
          
          await ghlService.createOpportunity({
            contactId: userId,
            pipelineId: process.env.GHL_PIPELINE_ID!,
            stageId: process.env.GHL_INITIAL_STAGE_ID!,
            name: `${firstName} - BMB Consultation`,
            monetaryValue: portfolioSize >= 1000000 ? 15000 : 
                          portfolioSize >= 500000 ? 8000 :
                          portfolioSize >= 250000 ? 4000 :
                          portfolioSize >= 100000 ? 2000 : 1000,
            status: 'open',
            source: 'Instagram DM',
            customFields: {
              portfolioSize: portfolioSize.toString(),
              painPoints: result.answers['Q3_pain_points']?.toString() || '',
              leadSource: 'Instagram DM Qualification'
            }
          });
          
          console.log('✅ GoHighLevel contact and opportunity updated');
        } catch (error) {
          console.error('❌ Error updating GoHighLevel:', error);
        }
      }
      
    } else if (result.isQualified === false) {
      console.log('📝 Lead marked for nurture');
      
      responseCustomFields.is_qualified = 'false';
      responseCustomFields.nurture_date = new Date().toISOString();
      
      // Update contact tags for nurture
      if (isGHLConfigured() && userId) {
        try {
          await ghlService.updateContact(userId, {
            tags: ['unqualified', 'nurture'],
            customFields: responseCustomFields
          });
        } catch (error) {
          console.error('❌ Error updating GoHighLevel:', error);
        }
      }
    }

    // Handle booking confirmation
    if (result.stage === 'end' && result.answers['email']) {
      console.log('📅 Booking confirmation with email');
      
      responseCustomFields.email = result.answers['email'];
      responseCustomFields.booking_confirmed = 'true';
      responseCustomFields.booking_date = new Date().toISOString();
      
      if (isGHLConfigured() && userId) {
        try {
          await ghlService.updateContact(userId, {
            email: result.answers['email'].toString(),
            tags: ['booked', 'high_intent'],
            customFields: responseCustomFields
          });
        } catch (error) {
          console.error('❌ Error updating GoHighLevel:', error);
        }
      }
    }

    // Use the stage directly from the graph result - no manual mapping
    const nextStage = result.stage;

    // Return response for GoHighLevel
    const response = ghlService.createWebhookResponse(
      result.response,
      nextStage,
      result.isQualified,
      responseCustomFields
    );
    // Only add is_specific to the top-level response if response is a plain object (not string, not array)
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      (response as any).is_specific = result.isSpecific;
      // Add intent at top level for easier access in GHL
      (response as any).intent = responseCustomFields.intent || '';
    }
    
    console.log('✅ GoHighLevel webhook processing completed');
    console.log('📤 Response:', JSON.stringify(response, null, 2));
    console.log('🔍 Intent value being sent:', responseCustomFields.intent || 'NOT SET');
    
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ GoHighLevel webhook processing error:', error);
    
    return NextResponse.json(
      ghlService.createErrorResponse("I'm having technical difficulties. Please try again in a moment."),
      { status: 200 } // Return 200 so GHL doesn't retry
    );
  }
}

// Handle OPTIONS for CORS
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