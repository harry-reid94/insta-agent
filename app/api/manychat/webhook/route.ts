import { NextRequest, NextResponse } from 'next/server';
import { graph, GraphState } from '../../../lib/graph';
import { manyChatService } from '../../../lib/integrations/manychat';
import { ghlService, isGHLConfigured } from '../../../lib/integrations/gohighlevel';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Handle ManyChat External Request webhooks (POST only)
export async function POST(req: NextRequest) {
  try {
    // Verify webhook authentication
    const authHeader = req.headers.get('authorization');
    console.log('🔐 Auth header received:', authHeader ? `${authHeader.substring(0, 20)}...` : 'none');
    console.log('🔐 Expected format: Bearer <your-secret>');
    
    if (!authHeader || !manyChatService.verifyWebhookAuth(authHeader)) {
      console.error('❌ ManyChat webhook authentication failed');
      console.error('   Received:', authHeader || 'No auth header');
      console.error('   Expected: Bearer bD0pCT3/A+0w72LT8KHNpluCtvV7EX+mXfgHE9ZsGj0=');
      return NextResponse.json({ 
        error: 'Unauthorized',
        response: "Sorry, I'm having trouble right now. Please try again later."
      }, { status: 401 });
    }

    let webhookData;
    try {
      // Try to get raw body first for debugging
      const rawBody = await req.text();
      console.log('📦 Raw request body:', rawBody || '(empty)');
      
      // Parse JSON
      webhookData = rawBody ? JSON.parse(rawBody) : {};
    } catch (jsonError) {
      console.log('⚠️  Invalid JSON in request body');
      console.log('   Error:', jsonError.message);
      return NextResponse.json({
        response: "✅ Webhook connected! Please check your External Request body configuration in ManyChat.",
        next_stage: "connected",
        actions: {
          set_field: {
            webhook_status: "connected",
            tested_at: new Date().toISOString()
          }
        }
      });
    }
    
    console.log('📨 ManyChat webhook received and authenticated');
    console.log('Webhook data:', JSON.stringify(webhookData, null, 2));

    // Handle ManyChat test requests (they often have minimal data)
    if (!webhookData.user_id || !webhookData.message || !webhookData.stage) {
      console.log('⚠️  Incomplete webhook data, checking if test request...');
      
      // If it's a test request with minimal data, return success
      if (Object.keys(webhookData).length < 3) {
        return NextResponse.json({
          response: "✅ Webhook connected! Ready to receive messages.",
          next_stage: "ready",
          actions: {
            set_field: {
              webhook_status: "connected",
              connected_at: new Date().toISOString()
            }
          }
        });
      }
    }

    // Process the webhook to extract message data
    const messageData = manyChatService.processWebhook(webhookData);
    if (!messageData) {
      console.log('⚠️  No actionable message data found in ManyChat webhook');
      return NextResponse.json(
        manyChatService.createErrorResponse("I didn't understand that. Can you try again?")
      );
    }

    const { userId, username, firstName, message, conversationId, stage, timestamp, previousAnswers } = messageData;

    console.log(`🤖 Processing message from ${firstName} (${username}) at stage: ${stage}`);

    // Build conversation state from ManyChat data (no Supabase)
    // Handle empty stage for new conversations and map custom stages to graph stages
    let currentStage = stage && stage !== '{{stage}}' ? stage : 'greeting';
    
    // Map our custom stages to stages the graph understands
    if (currentStage === 'greeting_response') {
      currentStage = 'rapport_building'; // User responded to greeting, progress to rapport building
    }
    
    const conversationState = {
      conversation_id: conversationId,
      instagram_user_id: userId,
      current_stage: currentStage,
      answers: previousAnswers || {},
      is_qualified: undefined,
      is_specific: false
    };

    // Build message history based on stage
    const graphMessages: any[] = [];
    
    // Handle greeting logic: if original stage is 'greeting', we need to send greeting first
    if (stage === 'greeting') {
      // Don't add user message, empty array triggers greetingNode
      console.log('🎯 Original stage is greeting → triggering greetingNode (empty messages)');
    } else {
      // Add user message for other stages (including greeting_response)
      console.log('➡️ Adding user message for processing');
      graphMessages.push(new HumanMessage(message));
    }

    // Invoke the graph with proper state
    const graphState: typeof GraphState.State = {
      messages: graphMessages,
      stage: currentStage as any, // Use the processed stage
      answers: conversationState.answers || {},
      lastQuestionAsked: conversationState.last_question_asked || '',
      isQualified: conversationState.is_qualified,
      currentQuestionId: undefined,
      repromptAttempts: conversationState.reprompt_attempts || {},
      location: conversationState.location,
      response: '',
      availableSlots: [],
      gender: conversationState.gender,
      instagramUsername: username,
      conversationId: conversationId
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
      hasResponse: !!result.response
    });

    if (!result.response) {
      console.log('⚠️  AI graph did not generate a response');
      return NextResponse.json(
        manyChatService.createErrorResponse("I'm having trouble responding right now. Please try again.")
      );
    }

    console.log('💬 AI generated response:', result.response.substring(0, 100) + '...');

    // Determine next stage based on conversation flow
    let nextStage = result.stage;
    let manyChatResponse;

    // Handle different conversation outcomes
    if (result.isQualified === true) {
      console.log('🎯 Lead qualified! Creating GoHighLevel contact...');
      
      // Create qualified lead in GoHighLevel if configured
      let ghlContactId = '';
      let bookingLink = '';
      
      if (isGHLConfigured()) {
        try {
          const portfolioSize = typeof result.answers['Q2_portfolio_size'] === 'number' 
            ? result.answers['Q2_portfolio_size'] 
            : parseInt(result.answers['Q2_portfolio_size']?.toString() || '0');

          const ghlResult = await ghlService.createQualifiedLead(
            firstName,
            '', // last name
            username,
            portfolioSize,
            result.answers['Q3_pain_points']?.toString() || '',
            result.answers['Q1_bmb_understanding']?.toString() || '',
            'ManyChat Instagram'
          );
          
          ghlContactId = ghlResult.contact.id || '';
          bookingLink = ghlResult.bookingLink;
          
          console.log('✅ GoHighLevel contact created:', ghlContactId);
        } catch (error) {
          console.error('❌ Error creating GoHighLevel contact:', error);
        }
      }

      // Create qualified response with ManyChat actions
      const portfolioSize = parseInt(result.answers['Q2_portfolio_size']?.toString() || '0');
      manyChatResponse = manyChatService.createQualifiedResponse(
        result.response,
        portfolioSize,
        ghlContactId,
        bookingLink
      );

    } else if (result.isQualified === false) {
      console.log('📝 Lead marked for nurture');

      // Create nurture response with ManyChat actions
      const portfolioSize = parseInt(result.answers['Q2_portfolio_size']?.toString() || '0');
      manyChatResponse = manyChatService.createNurtureResponse(
        result.response,
        portfolioSize
      );

    } else if (result.stage === 'end' && result.answers['email']) {
      console.log('📅 Booking confirmation with email');
      
      // Create booking confirmation response
      manyChatResponse = manyChatService.createBookingConfirmationResponse(
        result.response,
        result.answers['email'].toString(),
        ''  // ghlContactId not available in this scope
      );

    } else {
      // Regular conversation progression
      manyChatResponse = manyChatService.createStageResponse(
        result.response,
        stage,
        nextStage,
        {
          last_ai_response: result.response,
          updated_at: new Date().toISOString()
        }
      );
    }

    console.log('✅ ManyChat webhook processing completed successfully');
    console.log('📤 Returning response for ManyChat External Request...');
    console.log('📤 Response structure:', JSON.stringify(manyChatResponse, null, 2));

    // For Instagram: Return response in JSONPath-friendly format for ManyChat response mapping
    console.log('📤 Returning response for ManyChat response mapping...');
    
    // Force progression: after greeting, next message should go to rapport building
    let progressedStage = result.stage;
    if (result.stage === 'greeting' && currentStage === 'greeting') {
      // We just sent a greeting, next user response should progress
      progressedStage = 'greeting_response';
    } else if (currentStage === 'greeting_response') {
      // User responded to greeting, now progress to rapport building  
      progressedStage = 'rapport_building';
    }
    
    const mappingResponse = {
      ai_response: result.response,
      stage: progressedStage,
      next_stage: progressedStage,
      is_qualified: result.isQualified,
      // Include answers for later stages
      bmb_understanding: result.answers['Q1_bmb_understanding'] || '',
      portfolio_size: result.answers['Q2_portfolio_size'] || '',
      pain_points: result.answers['Q3_pain_points'] || ''
    };
    
    console.log('📤 Response mapping format:', JSON.stringify(mappingResponse, null, 2));
    
    // Test if ManyChat is reading the response correctly
    console.log('🔍 Testing JSONPath access:');
    console.log('   $.stage =', mappingResponse.stage);
    console.log('   $.ai_response =', mappingResponse.ai_response);
    
    return NextResponse.json(mappingResponse);

  } catch (error: any) {
    console.error('❌ ManyChat webhook processing error:', error);
    
    // Return error response that ManyChat can handle
    return NextResponse.json(
      manyChatService.createErrorResponse("I'm having technical difficulties. Please try again in a moment."),
      { status: 200 } // Return 200 so ManyChat doesn't retry
    );
  }
}

// Handle OPTIONS for CORS (if needed)
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