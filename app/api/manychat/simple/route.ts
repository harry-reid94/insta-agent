import { NextRequest, NextResponse } from 'next/server';

// Ultra-simple test endpoint to debug ManyChat response format
export async function POST(req: NextRequest) {
  console.log('Simple endpoint called');
  
  // Try different response formats to see what ManyChat accepts
  
  // Format 1: Simple text
  return NextResponse.json({
    text: "This is a simple test response from the webhook!"
  });
  
  // Format 2: Messages array (uncomment to test)
  // return NextResponse.json({
  //   messages: [
  //     { text: "This is a test response!" }
  //   ]
  // });
  
  // Format 3: ManyChat v2 format (uncomment to test)
  // return NextResponse.json({
  //   version: "v2",
  //   content: {
  //     messages: [
  //       {
  //         type: "text",
  //         text: "This is a test response!"
  //       }
  //     ]
  //   }
  // });
}