import { NextRequest, NextResponse } from 'next/server';

// Test different response formats for ManyChat
export async function POST(req: NextRequest) {
  console.log('Testing JSON response format');
  
  // Format that works with some External Request integrations
  return NextResponse.json({
    "version": "v2",
    "content": {
      "messages": [
        {
          "type": "text", 
          "text": "This is a test message from webhook-json endpoint!"
        }
      ]
    }
  });
}