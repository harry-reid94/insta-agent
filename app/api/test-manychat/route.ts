import { NextRequest, NextResponse } from 'next/server';
import { manyChatService, isManyChatConfigured } from '../../lib/integrations/manychat';

export async function GET(req: NextRequest) {
  try {
    // Check if ManyChat is configured
    if (!isManyChatConfigured()) {
      return NextResponse.json({
        error: 'ManyChat not configured',
        message: 'Please set MANYCHAT_WEBHOOK_SECRET in your .env.local file',
        configured: false
      }, { status: 400 });
    }

    console.log('🔧 Testing ManyChat integration...');
    
    const testResults = {
      configured: true,
      tests: {
        webhook_auth: { success: false, error: null, data: null },
        response_creation: { success: false, error: null, data: null },
        api_connection: { success: false, error: null, data: null }
      }
    };

    // Test 1: Webhook Authentication
    try {
      const testAuth = `Bearer ${process.env.MANYCHAT_WEBHOOK_SECRET}`;
      const authResult = manyChatService.verifyWebhookAuth(testAuth);
      
      if (authResult) {
        testResults.tests.webhook_auth.success = true;
        testResults.tests.webhook_auth.data = { 
          hasSecret: !!process.env.MANYCHAT_WEBHOOK_SECRET 
        };
        console.log('✅ Webhook authentication test successful');
      } else {
        testResults.tests.webhook_auth.error = 'Authentication verification failed';
        console.error('❌ Webhook authentication test failed');
      }
    } catch (error: any) {
      testResults.tests.webhook_auth.error = error.message;
      console.error('❌ Webhook authentication test error:', error.message);
    }

    // Test 2: Response Creation
    try {
      const testResponse = manyChatService.createStageResponse(
        "Test response message",
        "greeting",
        "location",
        { test_field: "test_value" }
      );
      
      testResults.tests.response_creation.success = true;
      testResults.tests.response_creation.data = {
        hasResponse: !!testResponse.response,
        hasNextStage: !!testResponse.next_stage,
        hasActions: !!testResponse.actions,
        responseLength: testResponse.response.length
      };
      console.log('✅ Response creation test successful');
    } catch (error: any) {
      testResults.tests.response_creation.error = error.message;
      console.error('❌ Response creation test error:', error.message);
    }

    // Test 3: API Connection (if token provided)
    try {
      const connectionTest = await manyChatService.testConnection();
      
      if (connectionTest.success) {
        testResults.tests.api_connection.success = true;
        testResults.tests.api_connection.data = connectionTest.data;
        console.log('✅ ManyChat API connection successful');
      } else {
        testResults.tests.api_connection.error = connectionTest.error;
        console.log('⚠️  ManyChat API connection failed (webhook-only mode):', connectionTest.error);
      }
    } catch (error: any) {
      testResults.tests.api_connection.error = error.message;
      console.error('❌ ManyChat API connection test error:', error.message);
    }

    // Test 4: Sample Webhook Processing
    const sampleWebhookData = {
      user_id: 'test_user_12345',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      message: 'Hello, I want to learn about BMB',
      stage: 'greeting',
      conversation_id: 'test_user_12345_manychat',
      timestamp: new Date().toISOString(),
      previous_answers: {}
    };

    try {
      const webhookResult = manyChatService.processWebhook(sampleWebhookData);
      
      if (webhookResult) {
        testResults.tests.response_creation.data = {
          ...testResults.tests.response_creation.data,
          sampleProcessing: {
            userId: webhookResult.userId,
            username: webhookResult.username,
            firstName: webhookResult.firstName,
            stage: webhookResult.stage,
            conversationId: webhookResult.conversationId
          }
        };
        console.log('✅ Sample webhook processing successful');
      }
    } catch (error: any) {
      console.log('⚠️  Sample webhook processing failed:', error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'ManyChat integration test completed',
      results: testResults,
      environment: {
        hasWebhookSecret: !!process.env.MANYCHAT_WEBHOOK_SECRET,
        hasApiToken: !!process.env.MANYCHAT_API_TOKEN,
        mode: process.env.MANYCHAT_API_TOKEN ? 'Full API' : 'Webhook-only'
      },
      sampleWebhookRequest: {
        url: '/api/manychat/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MANYCHAT_WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET'}`
        },
        body: sampleWebhookData
      }
    });

  } catch (error: any) {
    console.error('ManyChat test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      message: error.message 
    }, { status: 500 });
  }
}

// Test webhook endpoint with sample data
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('🧪 Testing ManyChat webhook with sample data...');
    
    // Test authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !manyChatService.verifyWebhookAuth(authHeader)) {
      return NextResponse.json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid or missing Authorization header'
      }, { status: 401 });
    }
    
    // Process the test webhook
    const result = manyChatService.processWebhook(body);
    
    if (result) {
      // Create a test response
      const testResponse = manyChatService.createStageResponse(
        `Hello ${result.firstName}! This is a test response to your message: "${result.message}"`,
        result.stage,
        'test_next_stage',
        { test_processed: true }
      );
      
      console.log('✅ Test webhook processed successfully');
      return NextResponse.json({
        success: true,
        message: 'Test webhook processed successfully',
        processedData: {
          userId: result.userId,
          username: result.username,
          firstName: result.firstName,
          messageLength: result.message.length,
          stage: result.stage,
          conversationId: result.conversationId
        },
        sampleResponse: testResponse
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No actionable data found in test webhook'
      });
    }

  } catch (error: any) {
    console.error('Test webhook error:', error);
    return NextResponse.json({ 
      error: 'Test webhook failed',
      message: error.message 
    }, { status: 500 });
  }
}