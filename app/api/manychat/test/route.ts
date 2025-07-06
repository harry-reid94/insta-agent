import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint for ManyChat "Test Request" button
export async function POST(req: NextRequest) {
  try {
    console.log('🧪 ManyChat test request received');
    
    // Log headers for debugging
    const headers: any = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Headers:', headers);
    
    // Get request body
    const body = await req.json().catch(() => ({}));
    console.log('Body:', body);
    
    // Return a simple test response
    return NextResponse.json({
      response: "✅ Webhook connected successfully! Your ngrok endpoint is working.",
      next_stage: "test_success",
      actions: {
        set_field: {
          webhook_test: "success",
          tested_at: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      response: "❌ Test failed: " + error.message,
      error: true
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Test endpoint is running",
    message: "Use POST method to test webhook"
  });
}