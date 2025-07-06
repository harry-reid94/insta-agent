import { NextRequest, NextResponse } from 'next/server';

// Test different response formats for ManyChat Instagram
export async function POST(req: NextRequest) {
  console.log('Testing different formats for Instagram');
  
  const testMessage = "This is a test message from the webhook!";
  
  // Format 1: Simple object with 'text' field
  return NextResponse.json({
    text: testMessage
  });
  
  // Format 2: Object with 'message' field (uncomment to test)
  // return NextResponse.json({
  //   message: testMessage
  // });
  
  // Format 3: Array format (uncomment to test)
  // return NextResponse.json([testMessage]);
  
  // Format 4: ManyChat's expected structure (uncomment to test)
  // return NextResponse.json({
  //   version: "v2",
  //   content: {
  //     messages: [
  //       {
  //         type: "text",
  //         text: testMessage
  //       }
  //     ]
  //   }
  // });
}